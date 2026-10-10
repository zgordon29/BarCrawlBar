"""Local server for Bar-Crawl Brawl: serves the game and relays phone controllers.

Run with the project's virtual environment:  .venv\\Scripts\\python serve.py [port]
"""
import io
import json
import mimetypes
import os
import socket
import sys

import segno
from aiohttp import WSMsgType, web

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_PHONES = 8

# Windows can map .js to text/plain, which browsers refuse for modules.
mimetypes.add_type("text/javascript", ".js")

hosts = set()   # game screens
phones = {}     # phone id -> websocket


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packets are sent; this just picks the LAN interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def phone_url():
    return f"http://{lan_ip()}:{PORT}/phone"


async def to_hosts(message):
    data = json.dumps(message)
    for ws in list(hosts):
        try:
            await ws.send_str(data)
        except ConnectionError:
            hosts.discard(ws)


async def host_socket(request):
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)
    hosts.add(ws)
    await ws.send_str(json.dumps({"t": "hello", "phones": sorted(phones)}))
    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            # The game can message one phone, e.g. to show its character or buzz it.
            try:
                data = json.loads(msg.data)
                target = phones.get(int(data.get("id", 0)))
            except (ValueError, TypeError, AttributeError):
                continue
            if target is not None:
                try:
                    await target.send_str(msg.data)
                except ConnectionError:
                    pass
    finally:
        hosts.discard(ws)
    return ws


async def phone_socket(request):
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)
    # A phone that reconnects asks for its old seat back.
    try:
        wanted = int(request.query.get("id", 0))
    except ValueError:
        wanted = 0
    if 1 <= wanted <= MAX_PHONES and wanted not in phones:
        pid = wanted
    else:
        pid = next((i for i in range(1, MAX_PHONES + 1) if i not in phones), 0)
    if not pid:
        await ws.send_str(json.dumps({"t": "full"}))
        await ws.close()
        return ws
    phones[pid] = ws
    await ws.send_str(json.dumps({"t": "you", "id": pid}))
    await to_hosts({"t": "join", "id": pid})
    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(msg.data)
                x = max(-1.0, min(1.0, float(data.get("x", 0))))
                y = max(-1.0, min(1.0, float(data.get("y", 0))))
                b = bool(data.get("b", False))
            except (ValueError, TypeError, AttributeError):
                continue
            await to_hosts({"t": "in", "id": pid, "x": x, "y": y, "b": b})
    finally:
        if phones.get(pid) is ws:
            del phones[pid]
            await to_hosts({"t": "leave", "id": pid})
    return ws


async def info(request):
    return web.json_response({"phoneUrl": phone_url()})


async def qr(request):
    buf = io.BytesIO()
    segno.make(phone_url(), error="m").save(buf, kind="svg", scale=8, border=2, dark="#140f1f", light="#ffffff")
    return web.Response(body=buf.getvalue(), content_type="image/svg+xml")


async def index(request):
    return web.FileResponse(os.path.join(ROOT, "index.html"))


async def phone_page(request):
    return web.FileResponse(os.path.join(ROOT, "phone.html"))


@web.middleware
async def no_cache(request, handler):
    response = await handler(request)
    # Always serve fresh files so edits show up on reload.
    response.headers["Cache-Control"] = "no-store"
    return response


app = web.Application(middlewares=[no_cache])
app.add_routes([
    web.get("/", index),
    web.get("/phone", phone_page),
    web.get("/info", info),
    web.get("/qr.svg", qr),
    web.get("/ws/host", host_socket),
    web.get("/ws/phone", phone_socket),
    web.static("/src", os.path.join(ROOT, "src")),
])

if __name__ == "__main__":
    print(f"Bar-Crawl Brawl: play at http://localhost:{PORT}", flush=True)
    print(f"Phone controllers join at {phone_url()}", flush=True)
    # 0.0.0.0 so phones on the same Wi-Fi can reach it.
    web.run_app(app, host="0.0.0.0", port=PORT, print=None)
