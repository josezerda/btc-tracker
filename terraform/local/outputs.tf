output "app_url" {
  description = "URL de la pagina web BTC Tracker"
  value       = "http://localhost:${var.app_port}"
}

output "metrics_url" {
  description = "Endpoint de metricas que scrapea Prometheus"
  value       = "http://localhost:${var.app_port}/metrics"
}

output "prometheus_url" {
  description = "URL de Prometheus"
  value       = "http://localhost:${var.prometheus_port}"
}

output "grafana_url" {
  description = "URL de Grafana (usuario admin)"
  value       = "http://localhost:${var.grafana_port}"
}

output "app_image_id" {
  description = "ID de la imagen desplegada"
  value       = docker_image.app.image_id
}
