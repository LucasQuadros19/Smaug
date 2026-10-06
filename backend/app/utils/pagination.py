from flask import request

DEFAULT_PER_PAGE = 50
MAX_PER_PAGE = 200


def paginate(query, serialize, default_per_page=DEFAULT_PER_PAGE):
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", default_per_page, type=int), 1), MAX_PER_PAGE)
    result = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [serialize(i) for i in result.items],
        "total": result.total,
        "page": result.page,
        "per_page": result.per_page,
        "pages": result.pages,
    }
