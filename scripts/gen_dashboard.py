"""Genera monitoring/grafana/dashboards/btc-tracker.json (dashboard de Grafana).

Uso: python3 scripts/gen_dashboard.py
"""
import json
import pathlib

DS = {"type": "prometheus", "uid": "prometheus"}
_id = 0


def nid():
    global _id
    _id += 1
    return _id


def target(expr, legend="", ref="A"):
    return {"datasource": DS, "expr": expr, "legendFormat": legend, "refId": ref}


def stat(title, expr, x, y, w=5, h=5, unit="none", decimals=None, mappings=None,
         thresholds=None, color_mode="value"):
    defaults = {"unit": unit, "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute",
                               "steps": thresholds or [{"color": "#f7931a", "value": None}]}}
    if decimals is not None:
        defaults["decimals"] = decimals
    if mappings:
        defaults["mappings"] = mappings
    return {
        "id": nid(), "type": "stat", "title": title, "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [target(expr)],
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "colorMode": color_mode, "graphMode": "area", "textMode": "value",
                    "justifyMode": "center", "orientation": "auto"},
    }


def ts(title, targets, x, y, w=12, h=8, unit="none", decimals=None):
    defaults = {"unit": unit, "custom": {"lineWidth": 2, "fillOpacity": 10,
                                         "showPoints": "never", "spanNulls": True}}
    if decimals is not None:
        defaults["decimals"] = decimals
    return {
        "id": nid(), "type": "timeseries", "title": title, "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": targets,
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {"legend": {"displayMode": "list", "placement": "bottom"},
                    "tooltip": {"mode": "multi"}},
    }


panels = [
    stat("Estado de la app", 'up{job="btc-tracker"}', 0, 0, w=4,
         mappings=[{"type": "value", "options": {
             "0": {"text": "DOWN", "color": "red"}, "1": {"text": "UP", "color": "green"}}}],
         thresholds=[{"color": "red", "value": None}, {"color": "green", "value": 1}],
         color_mode="background"),
    stat("BTC / USD", 'btc_price{currency="usd"}', 4, 0, unit="currencyUSD", decimals=0),
    stat("BTC / EUR", 'btc_price{currency="eur"}', 9, 0, unit="currencyEUR", decimals=0),
    stat("Variacion 24 h", "btc_change_24h_percent", 14, 0, unit="percent", decimals=2,
         thresholds=[{"color": "red", "value": None}, {"color": "green", "value": 0}]),
    stat("Requests / s", 'sum(rate(http_requests_total{job="btc-tracker"}[1m]))', 19, 0,
         unit="reqps", decimals=2, thresholds=[{"color": "blue", "value": None}]),

    ts("Cotizacion BTC (USD)", [target('btc_price{currency="usd"}', "USD")], 0, 5,
       unit="currencyUSD", decimals=0),
    ts("Requests por ruta y estado",
       [target('sum by (route, status) (rate(http_requests_total{job="btc-tracker"}[1m]))',
               "{{route}} {{status}}")], 12, 5, unit="reqps"),

    ts("Latencia p95 por ruta",
       [target('histogram_quantile(0.95, sum by (le, route) '
               '(rate(http_request_duration_seconds_bucket{job="btc-tracker"}[5m])))',
               "{{route}}")], 0, 13, unit="s"),
    ts("Llamadas a la API externa (CoinGecko)",
       [target('sum by (result) (increase(btc_upstream_requests_total{job="btc-tracker"}[5m]))',
               "{{result}}"),
        target('histogram_quantile(0.95, sum by (le) '
               '(rate(btc_upstream_request_duration_seconds_bucket[5m])))',
               "latencia p95 (s)", "B")], 12, 13),

    ts("Memoria (RSS)", [target('process_resident_memory_bytes{job="btc-tracker"}', "RSS")],
       0, 21, w=8, unit="bytes"),
    ts("CPU", [target('rate(process_cpu_seconds_total{job="btc-tracker"}[1m])', "CPU")],
       8, 21, w=8, unit="percentunit"),
    ts("Event loop lag (Node.js)",
       [target('nodejs_eventloop_lag_p99_seconds{job="btc-tracker"}', "p99")],
       16, 21, w=8, unit="s"),
]

dashboard = {
    "uid": "btc-tracker",
    "title": "BTC Tracker - Metricas basicas",
    "tags": ["btc-tracker", "devops"],
    "timezone": "browser",
    "editable": True,
    "refresh": "15s",
    "schemaVersion": 39,
    "version": 1,
    "time": {"from": "now-1h", "to": "now"},
    "panels": panels,
    "templating": {"list": []},
    "annotations": {"list": []},
}

out = pathlib.Path(__file__).resolve().parent.parent / "monitoring/grafana/dashboards/btc-tracker.json"
out.write_text(json.dumps(dashboard, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Dashboard escrito en {out}")
