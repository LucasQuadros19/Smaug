"""Cada usuário só alcança os próprios dados.

Todo model que herda `Owned` ganha `user_id`. Dentro de uma requisição:
- SELECT, UPDATE e DELETE só enxergam linhas do dono da sessão (`g.owner_id`),
  inclusive somas, joins e relacionamentos;
- ao salvar, a linha nova recebe o dono, e apontar para um registro de outro
  usuário (conta, categoria, posição...) é recusado.

Fora de requisição (migrações, comandos, preparo dos testes) não há filtro.
"""

from flask import g, has_request_context
from sqlalchemy import event, false, inspect, update
from sqlalchemy.orm import Session, declared_attr, with_loader_criteria
from werkzeug.exceptions import BadRequest, Forbidden

from app.extensions import db


class Owned:
    @declared_attr
    def user_id(cls):
        return db.Column(db.Uuid, db.ForeignKey("users.id"), index=True)


def owned_models():
    return [m.class_ for m in db.Model.registry.mappers if issubclass(m.class_, Owned)]


def claim_orphans(user_id):
    """Passa para `user_id` tudo que ainda não tem dono (os dados de antes das contas)."""
    for model in owned_models():
        table = model.__table__
        db.session.execute(
            update(table).where(table.c.user_id.is_(None)).values(user_id=user_id),
            execution_options={"all_owners": True},
        )


@event.listens_for(Session, "do_orm_execute")
def _only_own_rows(state):
    if not has_request_context() or state.is_column_load or state.execution_options.get("all_owners"):
        return
    if not (state.is_select or state.is_update or state.is_delete):
        return
    owner = g.get("owner_id")
    # Duas lambdas separadas: o SQLAlchemy guarda o SQL gerado por cada uma.
    if owner is None:
        criteria = lambda cls: false()
    else:
        criteria = lambda cls: cls.user_id == owner
    state.statement = state.statement.options(with_loader_criteria(Owned, criteria, include_aliases=True))


_by_table = {}


def _owned_model(table):
    if not _by_table:
        _by_table.update({model.__table__: model for model in owned_models()})
    return _by_table.get(table)


@event.listens_for(Session, "before_flush")
def _stamp_and_check_owner(session, _context, _instances):
    if not has_request_context():
        return
    owner = g.get("owner_id")
    for obj in [*session.new, *session.dirty]:
        if not isinstance(obj, Owned):
            continue
        if obj.user_id is None and obj in session.new:
            obj.user_id = owner
        if owner is None or obj.user_id != owner:
            raise Forbidden()
        _check_references(session, obj)


def _check_references(session, obj):
    state = inspect(obj)
    for fk in state.mapper.local_table.foreign_keys:
        target = _owned_model(fk.column.table)
        if target is None:
            continue
        key = state.mapper.get_property_by_column(fk.parent).key
        value = getattr(obj, key)
        if value is None or (obj not in session.new and not state.attrs[key].history.has_changes()):
            continue
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise BadRequest(f"{key} inválido")
        with session.no_autoflush:
            if session.get(target, value) is None:
                raise BadRequest(f"{key} inválido")
