locals {
  prefix          = "btc-${var.environment}"
  monitoring_path = "${path.module}/../../monitoring"

  common_labels = {
    "project"    = "btc-tracker"
    "managed-by" = "terraform"
    "env"        = var.environment
  }
}

# ---------------------------------------------------------------------------
# Red y volumenes
# ---------------------------------------------------------------------------
resource "docker_network" "this" {
  name   = "${local.prefix}-net"
  driver = "bridge"

  dynamic "labels" {
    for_each = local.common_labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_volume" "prometheus_data" {
  name = "${local.prefix}-prometheus-data"
}

resource "docker_volume" "grafana_data" {
  name = "${local.prefix}-grafana-data"
}

# ---------------------------------------------------------------------------
# Imagenes
# ---------------------------------------------------------------------------
# La imagen de la app la genera el pipeline; si ya existe localmente no se descarga.
resource "docker_image" "app" {
  name         = var.app_image
  keep_locally = true
}

resource "docker_image" "prometheus" {
  name         = var.prometheus_image
  keep_locally = true
}

resource "docker_image" "grafana" {
  name         = var.grafana_image
  keep_locally = true
}

# ---------------------------------------------------------------------------
# Aplicacion BTC Tracker (endurecida: read-only, sin capabilities, sin escalado)
# ---------------------------------------------------------------------------
resource "docker_container" "app" {
  name     = "${local.prefix}-app"
  image    = docker_image.app.image_id
  restart  = "unless-stopped"
  must_run = true

  read_only     = true
  tmpfs         = { "/tmp" = "rw,noexec,nosuid,size=16m" }
  security_opts = ["no-new-privileges:true"]
  memory        = 256

  capabilities {
    drop = ["ALL"]
  }

  env = [
    "NODE_ENV=production",
    "PORT=3000",
    "CACHE_TTL_MS=30000",
  ]

  ports {
    internal = 3000
    external = var.app_port
    ip       = var.bind_ip
  }

  networks_advanced {
    name    = docker_network.this.name
    aliases = ["btc-tracker"]
  }

  healthcheck {
    test         = ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health"]
    interval     = "15s"
    timeout      = "5s"
    retries      = 3
    start_period = "10s"
  }

  wait         = true
  wait_timeout = 90

  dynamic "labels" {
    for_each = merge(local.common_labels, { "component" = "app" })
    content {
      label = labels.key
      value = labels.value
    }
  }
}

# ---------------------------------------------------------------------------
# Prometheus
# ---------------------------------------------------------------------------
resource "docker_container" "prometheus" {
  name          = "${local.prefix}-prometheus"
  image         = docker_image.prometheus.image_id
  restart       = "unless-stopped"
  security_opts = ["no-new-privileges:true"]

  command = [
    "--config.file=/etc/prometheus/prometheus.yml",
    "--storage.tsdb.path=/prometheus",
    "--storage.tsdb.retention.time=7d",
    "--web.enable-lifecycle",
  ]

  upload {
    file    = "/etc/prometheus/prometheus.yml"
    content = file("${local.monitoring_path}/prometheus/prometheus.yml")
  }

  volumes {
    volume_name    = docker_volume.prometheus_data.name
    container_path = "/prometheus"
  }

  ports {
    internal = 9090
    external = var.prometheus_port
    ip       = var.bind_ip
  }

  networks_advanced {
    name    = docker_network.this.name
    aliases = ["prometheus"]
  }

  dynamic "labels" {
    for_each = merge(local.common_labels, { "component" = "prometheus" })
    content {
      label = labels.key
      value = labels.value
    }
  }

  depends_on = [docker_container.app]
}

# ---------------------------------------------------------------------------
# Grafana (datasource y dashboard aprovisionados automaticamente)
# ---------------------------------------------------------------------------
resource "docker_container" "grafana" {
  name          = "${local.prefix}-grafana"
  image         = docker_image.grafana.image_id
  restart       = "unless-stopped"
  security_opts = ["no-new-privileges:true"]

  env = [
    "GF_SECURITY_ADMIN_USER=admin",
    "GF_SECURITY_ADMIN_PASSWORD=${var.grafana_admin_password}",
    "GF_USERS_ALLOW_SIGN_UP=false",
    "GF_ANALYTICS_REPORTING_ENABLED=false",
    "GF_ANALYTICS_CHECK_FOR_UPDATES=false",
    "GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/dashboards/btc-tracker.json",
    "GF_AUTH_ANONYMOUS_ENABLED=${var.grafana_anonymous_viewer}",
    "GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer",
  ]

  upload {
    file    = "/etc/grafana/provisioning/datasources/datasource.yml"
    content = file("${local.monitoring_path}/grafana/provisioning/datasources/datasource.yml")
  }

  upload {
    file    = "/etc/grafana/provisioning/dashboards/dashboards.yml"
    content = file("${local.monitoring_path}/grafana/provisioning/dashboards/dashboards.yml")
  }

  upload {
    file    = "/etc/grafana/dashboards/btc-tracker.json"
    content = file("${local.monitoring_path}/grafana/dashboards/btc-tracker.json")
  }

  volumes {
    volume_name    = docker_volume.grafana_data.name
    container_path = "/var/lib/grafana"
  }

  ports {
    internal = 3000
    external = var.grafana_port
    ip       = var.bind_ip
  }

  networks_advanced {
    name    = docker_network.this.name
    aliases = ["grafana"]
  }

  dynamic "labels" {
    for_each = merge(local.common_labels, { "component" = "grafana" })
    content {
      label = labels.key
      value = labels.value
    }
  }

  depends_on = [docker_container.prometheus]
}
