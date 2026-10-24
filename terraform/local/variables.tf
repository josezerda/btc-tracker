variable "docker_host" {
  description = "Daemon Docker donde se despliega (el de la VM de VirtualBox o el del runner de CI)"
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "environment" {
  description = "Nombre del entorno (se usa como prefijo de los recursos)"
  type        = string
  default     = "local"
}

variable "app_image" {
  description = "Imagen de la aplicacion generada por el pipeline (ej: ghcr.io/usuario/btc-tracker:sha-abc1234)"
  type        = string
  default     = "btc-tracker:latest"
}

variable "app_port" {
  description = "Puerto del host donde se publica la web"
  type        = number
  default     = 3000
}

variable "prometheus_image" {
  description = "Imagen de Prometheus (version fijada)"
  type        = string
  default     = "prom/prometheus:v3.15.1"
}

variable "prometheus_port" {
  description = "Puerto del host para Prometheus"
  type        = number
  default     = 9090
}

variable "grafana_image" {
  description = "Imagen de Grafana (version fijada)"
  type        = string
  default     = "grafana/grafana:13.2.4"
}

variable "grafana_port" {
  description = "Puerto del host para Grafana"
  type        = number
  default     = 3001
}

variable "grafana_admin_password" {
  description = "Password del usuario admin de Grafana (pasar via TF_VAR_grafana_admin_password o terraform.tfvars)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.grafana_admin_password) >= 8
    error_message = "La password de Grafana debe tener al menos 8 caracteres."
  }
}

variable "grafana_anonymous_viewer" {
  description = "Permite ver dashboards sin login (rol Viewer). Solo para el entorno efimero de CI que toma la captura."
  type        = bool
  default     = false
}

variable "bind_ip" {
  description = "IP del host donde se publican los puertos (0.0.0.0 para acceder desde fuera de la VM)"
  type        = string
  default     = "0.0.0.0"
}
