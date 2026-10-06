from app import create_app
from app.extensions import db
from app.models.category import Category

DEFAULT_CATEGORIES = [
    # Receitas
    {"name": "Salário", "type": "income", "color": "#22c55e", "icon": "💼"},
    {"name": "Freelance / Renda extra", "type": "income", "color": "#84cc16", "icon": "🧑‍💻"},
    {"name": "Investimentos", "type": "income", "color": "#10b981", "icon": "📈"},
    {"name": "Vendas", "type": "income", "color": "#14b8a6", "icon": "🏷️"},
    {"name": "Reembolso", "type": "income", "color": "#06b6d4", "icon": "💳"},
    {"name": "Presente recebido", "type": "income", "color": "#a3e635", "icon": "🎉"},
    {"name": "Outras receitas", "type": "income", "color": "#65a30d", "icon": "💵"},
    # Despesas
    {"name": "Alimentação", "type": "expense", "color": "#f97316", "icon": "🍔"},
    {"name": "Mercado", "type": "expense", "color": "#fb923c", "icon": "🛒"},
    {"name": "Transporte", "type": "expense", "color": "#eab308", "icon": "🚗"},
    {"name": "Moradia", "type": "expense", "color": "#f43f5e", "icon": "🏠"},
    {"name": "Contas e utilidades", "type": "expense", "color": "#facc15", "icon": "💡"},
    {"name": "Assinaturas", "type": "expense", "color": "#a855f7", "icon": "📺"},
    {"name": "Lazer", "type": "expense", "color": "#8b5cf6", "icon": "🎮"},
    {"name": "Saúde", "type": "expense", "color": "#06b6d4", "icon": "💊"},
    {"name": "Educação", "type": "expense", "color": "#3b82f6", "icon": "📚"},
    {"name": "Vestuário", "type": "expense", "color": "#ec4899", "icon": "👕"},
    {"name": "Cuidados pessoais", "type": "expense", "color": "#f472b6", "icon": "🧴"},
    {"name": "Pets", "type": "expense", "color": "#78716c", "icon": "🐾"},
    {"name": "Presentes e doações", "type": "expense", "color": "#fb7185", "icon": "🎁"},
    {"name": "Investimentos", "type": "expense", "color": "#10b981", "icon": "💹"},
    {"name": "Impostos e taxas", "type": "expense", "color": "#64748b", "icon": "🏛️"},
    {"name": "Outras despesas", "type": "expense", "color": "#64748b", "icon": "🧾"},
]


def run():
    app = create_app()
    with app.app_context():
        existing = {(c.name, c.type) for c in Category.query.all()}
        created = 0
        for cat in DEFAULT_CATEGORIES:
            if (cat["name"], cat["type"]) not in existing:
                db.session.add(Category(**cat))
                created += 1
        db.session.commit()
        print(f"Categorias criadas: {created}")


if __name__ == "__main__":
    run()
