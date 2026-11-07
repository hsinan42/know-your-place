"""Exercise an isolated development API. --seed-legacy creates a synthetic v0 SQLite fixture."""
import http.cookiejar
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path


BASE = os.environ.get("SMOKE_URL", "http://localhost:5080")
MEMBER_PASSWORD = "independent-smoke-password"
LEGACY_STATE = {
    "settings": {"salary": 1200, "savingsTarget": 100, "trackingStart": "2026-10-01"},
    "categories": [],
    "cards": [{"id": "legacy-card", "name": "Legacy test card", "closingDay": 15, "dueDays": 10, "statementDates": None}],
    "expenses": [],
    "incomes": [],
    "subscriptions": [],
    "installments": [],
    "payments": [],
}


def seed_legacy():
    directory = Path(os.environ["DATA_DIR"])
    directory.mkdir(parents=True, exist_ok=True)
    database = directory / "finance.db"
    if database.exists():
        raise RuntimeError("Use a new disposable DATA_DIR for the legacy fixture.")
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE Documents (Id INTEGER PRIMARY KEY, Json TEXT NOT NULL, Version INTEGER NOT NULL)")
        connection.execute("INSERT INTO Documents VALUES (1, ?, 17)", (json.dumps(LEGACY_STATE),))


class Browser:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.account = None

    def req(self, path, method="GET", data=None, tag=None, header=True, account=None, cookie=None):
        headers = {"Content-Type": "application/json"}
        if header:
            headers["X-Finance-Request"] = "1"
        if account or self.account:
            headers["X-Finance-Account"] = account or self.account
        if tag:
            headers["If-Match"] = tag
        if cookie:
            headers["Cookie"] = cookie
        request = urllib.request.Request(BASE + "/api/" + path,
            data=json.dumps(data).encode() if data is not None else None, method=method, headers=headers)
        try:
            with self.client.open(request, timeout=10) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers

    def login(self, username, password, remember=False):
        status, raw, headers = self.req("login", "POST",
            {"username": username, "password": password, "rememberMe": remember})
        assert status == 200, (status, raw)
        account = json.loads(raw)
        self.account = account["id"]
        assert set(account) == {"id", "username", "isOwner", "tourPending"}
        assert json.loads(self.req("session")[1]) == account
        return account, headers["Set-Cookie"]

    def state(self):
        status, raw, headers = self.req("state")
        assert status == 200, (status, raw)
        assert "no-transform" in headers["Cache-Control"]
        assert headers["X-Finance-Revision"] == headers["ETag"]
        return json.loads(raw), headers["ETag"]


def run():
    owner, member, stranger = Browser(), Browser(), Browser()
    password = os.environ["ADMIN_PASSWORD"]
    assert stranger.req("state")[0] == 401
    assert stranger.req("session")[0] == 401
    assert stranger.req("users", "POST", {"username": "other", "password": MEMBER_PASSWORD})[0] == 404
    assert owner.req("login", "POST", {"username": "owner", "password": password}, header=False)[0] == 400
    assert owner.req("login", "POST", {"username": "owner", "password": "incorrect"})[0] == 401
    owner_account, owner_cookie = owner.login("OWNER", password)
    assert owner_account["isOwner"] and not owner_account["tourPending"]
    assert json.loads(owner.req("tour/start", "POST")[1]) == {"started": False}
    assert "httponly" in owner_cookie.lower() and "samesite=strict" in owner_cookie.lower()
    assert "expires=" not in owner_cookie.lower() and "max-age=" not in owner_cookie.lower()
    if os.environ.get("SMOKE_SECURE") == "1":
        assert "secure" in owner_cookie.lower()
    jwt = owner_cookie.split(";", 1)[0]
    jwt_parts = jwt.split(".")
    assert len(jwt_parts) == 3
    signature = jwt_parts[-1]
    jwt_parts[-1] = ("B" if signature[0] == "A" else "A") + signature[1:]
    assert stranger.req("session", cookie=".".join(jwt_parts))[0] == 401
    assert stranger.req("state", cookie=jwt)[0] == 401  # Missing browser account context.

    state, tag = owner.state()
    if os.environ.get("SMOKE_LEGACY") == "1":
        assert tag == '"17"'
        assert all(state[key] == value for key, value in LEGACY_STATE.items())
        with sqlite3.connect(Path(os.environ["SQLITE_IMPORT_PATH"]).as_uri() + "?mode=ro", uri=True) as connection:
            original = connection.execute("SELECT Json, Version FROM Documents").fetchall()
            assert original == [(json.dumps(LEGACY_STATE), 17)]
    else:
        assert tag == '"1"'
        state["cards"].extend(LEGACY_STATE["cards"])

    status, _, headers = owner.req("state", "PUT", state, tag)
    assert status == 200 and headers["ETag"] != tag and headers["X-Finance-Revision"] == headers["ETag"]
    assert owner.req("state", "PUT", state, tag)[0] == 409
    state, tag = owner.state()
    state["incomes"].append({"id": "owner-income", "date": "2001-01-01", "type": "Test", "description": "Owner", "amount": 100})
    assert owner.req("state", "PUT", state, tag, header=False)[0] == 400
    assert owner.req("state", "PUT", state, tag)[0] == 200

    bad, tag = owner.state()
    bad["installments"].append({"id": "bad", "name": "Invalid", "category": "", "amount": 1, "firstDate": "2026-11-01", "count": 0})
    assert owner.req("state", "PUT", bad, tag)[0] == 400
    assert owner.req("state", "PUT", {**state, "expenses": None}, tag)[0] == 400

    new_user = {"username": "Test.Member", "password": MEMBER_PASSWORD}
    assert stranger.req("register", "POST", {**new_user, "password": "short"})[0] == 400
    assert stranger.req("register", "POST", new_user, header=False)[0] == 400
    status, raw, _ = stranger.req("register", "POST", new_user)
    assert status == 201, (status, raw)
    assert stranger.req("register", "POST", {**new_user, "username": "TEST.MEMBER"})[0] == 409
    assert stranger.req("register", "POST", {**new_user, "username": "Owner"})[0] == 409

    member_account, member_cookie = member.login("test.member", MEMBER_PASSWORD, remember=True)
    assert member_account == json.loads(raw) and not member_account["isOwner"] and member_account["tourPending"]
    assert "expires=" not in member_cookie.lower() and "httponly" in member_cookie.lower()
    assert member.req("tour/start", "POST", account=owner.account)[0] == 401
    assert json.loads(member.req("tour/start", "POST")[1]) == {"started": True}
    assert json.loads(member.req("tour/start", "POST")[1]) == {"started": False}
    assert not json.loads(member.req("session")[1])["tourPending"]
    member_state, member_tag = member.state()
    assert member_state["incomes"] == [] and member_state["cards"] == []
    assert member_state["settings"]["salary"] == 0 and member_state["settings"]["savingsTarget"] == 0
    assert all(category["monthlyLimit"] == 0 for category in member_state["categories"])
    assert member.req("state", "PUT", state, member_tag, account=owner.account)[0] == 401
    assert member.req("state", account=owner.account)[0] == 401
    assert owner.req("state", account=member.account)[0] == 401
    assert member.req("report/2026/11", account=owner.account)[0] == 401
    assert member.req("card-outlook/2026/11", account=owner.account)[0] == 401

    member_state["incomes"].append({"id": "member-income", "date": "2001-01-01", "type": "Test", "description": "Member", "amount": 37})
    assert member.req("state", "PUT", member_state, member_tag)[0] == 200
    assert [item["id"] for item in owner.state()[0]["incomes"]] == ["owner-income"]
    assert [item["id"] for item in member.state()[0]["incomes"]] == ["member-income"]
    assert json.loads(owner.req("report/2026/11")[1])["assets"]["balance"] == 100
    assert json.loads(member.req("report/2026/11")[1])["assets"]["balance"] == 37
    assert json.loads(owner.req("report/2027/1")[1])["months"][0]["openingBalance"] == 100
    assert json.loads(owner.req("card-outlook/2026/11")[1])[0]["statements"][0]["cardId"] == "legacy-card"
    assert all(not period["statements"] for period in json.loads(member.req("card-outlook/2026/11")[1]))
    assert owner.req("report/2026/13")[0] == 400

    exercise_postgres_lists(owner, member)

    profile = {"username": "renamed.member", "currentPassword": MEMBER_PASSWORD, "newPassword": "new-member-test-password"}
    assert member.req("profile", "PUT", profile, header=False)[0] == 400
    assert member.req("profile", "PUT", profile, account=owner.account)[0] == 401
    assert member.req("profile", "PUT", {**profile, "currentPassword": "wrong"})[0] == 400
    assert member.req("profile", "PUT", {**profile, "username": "owner"})[0] == 409
    original_id = member.account
    assert member.req("profile", "PUT", profile)[0] == 204
    assert stranger.req("session", cookie=member_cookie.split(";", 1)[0])[0] == 401
    assert member.req("login", "POST", {"username": "test.member", "password": MEMBER_PASSWORD})[0] == 401
    renamed, member_cookie = member.login(profile["username"], profile["newPassword"])
    assert renamed["id"] == original_id and not renamed["tourPending"]
    assert [item["id"] for item in member.state()[0]["incomes"]] == ["member-income"]

    assert member.req("logout", "POST", header=False)[0] == 400
    assert member.req("logout", "POST", account=owner.account)[0] == 401
    assert member.req("logout", "POST")[0] == 200
    assert member.req("session")[0] == 401
    assert stranger.req("session", cookie=member_cookie.split(";", 1)[0])[0] == 401
    assert owner.req("session")[0] == 200
    assert owner.req("logout", "POST")[0] == 200
    assert stranger.req("session", cookie=jwt)[0] == 401
    print("API smoke passed: import, signup, one-time tour, profile update, JWT revocation, data isolation, CSRF, reports and revisions.")


def exercise_postgres_lists(owner, member):
    state, tag = owner.state()
    state["categories"].append({"id": "test-category", "name": "İçecek", "monthlyLimit": 0})
    state["expenses"].extend({
        "id": f"expense-{index}", "date": "2026-11-01" if index < 25 else "2026-10-01",
        "description": f"İçecek {index}", "amount": index + 1, "categoryId": "test-category", "method": "Nakit",
    } for index in range(31))
    state["subscriptions"].append({"id": "planned", "name": "Gelecek plan", "amount": 12, "category": "", "paymentDay": 1,
                                   "start": "2099-01-01"})
    state["installments"].append({"id": "plan", "name": "Taksit", "category": "", "amount": 12, "count": 2,
                                  "firstDate": "2026-11-01"})
    assert owner.req("state", "PUT", state, tag)[0] == 200

    def page(client, collection, query=""):
        status, raw, _ = client.req(f"lists/{collection}/2026/11?{query}")
        assert status == 200, (collection, status, raw)
        return json.loads(raw)

    base = "period=selected&sort=amount&direction=descending&size=10"
    result = page(owner, "expenses", base + "&page=2")
    assert result["total"] == 25 and result["page"] == 2
    assert [row["amount"] for row in result["items"]] == list(range(15, 5, -1))
    result = page(owner, "expenses", base + "&page=999&search=i%C3%A7ecek&category=test-category&method=Nakit&card=cash")
    assert result["total"] == 25 and result["page"] == 3
    assert [row["amount"] for row in result["items"]] == [5, 4, 3, 2, 1]
    assert page(owner, "expenses", "search=%25")["total"] == 0
    assert page(owner, "expenses", "size=100")["total"] == 31
    workspace = json.loads(owner.req("workspace")[1])
    assert workspace["expenses"] == [] and workspace["incomes"] == [] and workspace["installments"] == []
    assert workspace["categories"][-1]["name"] == "İçecek"
    assert page(owner, "category-totals", "period=selected")["items"] == [{"test-category": 325}]
    assert page(owner, "payment-periods")["items"] == [[]]
    assert page(member, "expenses", base)["items"] == []
    assert member.req("lists/expenses/2026/11", account=owner.account)[0] == 401
    assert owner.req("lists/expenses/2026/11?sort=sql")[0] == 400
    assert owner.req("lists/expenses/2026/11?size=101")[0] == 400
    assert page(owner, "subscriptions", "status=Planlanan")["items"][0]["id"] == "planned"
    assert page(owner, "installments", "status=Devam%20ediyor")["items"][0]["id"] == "plan"
    assert page(owner, "transactions", "kind=expense&period=selected&size=5")["total"] == 25
    assert page(owner, "incomes")["items"][0]["id"] == "owner-income"
    for collection in ("statements", "statement-items", "cash-dues", "upcoming", "payment-history", "categories"):
        page(owner, collection)
    print("PostgreSQL list queries passed: sorting, literal Turkish search, filters, bounds, pagination, and account isolation.")


if __name__ == "__main__":
    if "--seed-legacy" in sys.argv:
        seed_legacy()
    else:
        run()
