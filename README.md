# Proyecto 1 — CI/CD con GitHub Actions + Terraform + Docker

**Aplicacion:** BTC Tracker, una pagina web que muestra la cotizacion de Bitcoin (USD / EUR / ARS)
en tiempo real, con la variacion de las ultimas 24 h. Los datos vienen de la API publica de CoinGecko.

```
Navegador ──► BTC Tracker (Node.js/Express, contenedor Docker) ──► API CoinGecko
                    │  /metrics
                    ▼
               Prometheus ──► Grafana (dashboard aprovisionado)

Todo el stack (red, volumenes, 3 contenedores) se crea con Terraform.
```

## Que cubre cada requisito

| Requisito | Donde esta |
|---|---|
| Pipeline que compila, testea y despliega | `.github/workflows/ci-cd.yml` |
| Aplicacion generada con IA | `src/`, `public/` (generada con Claude) |
| Contenedor Docker | `Dockerfile` (multi-stage, usuario no root, healthcheck, sin npm en runtime) |
| Infraestructura con Terraform | `terraform/local/*.tf` (provider `kreuzwerker/docker`) |
| Seguridad: SonarQube / ESLint | job `sonarqube` + `npm run lint` en `build-test` |
| Seguridad: Snyk | jobs `snyk` (SCA + SAST), `iac` (Snyk IaC) y `docker` (Snyk Container) |
| Extra de seguridad | `npm audit`, escaneo de imagen con Grype, Helmet (CSP, cabeceras), contenedor read-only sin capabilities |
| SBOM CycloneDX / SPDX | `sbom/sbom-npm.cdx.json` + artefactos `sbom-image` (CycloneDX y SPDX de la imagen) |
| Monitoreo Prometheus + Grafana | `monitoring/`, desplegados por Terraform |
| Captura del dashboard | `capturas/` (la genera el job `deploy`) |
| Opcion local (VirtualBox) | `Vagrantfile` + job opcional `deploy-vm` |

## Etapas del pipeline

1. **build-test** — `npm ci`, ESLint, Jest con cobertura, `npm audit`, SBOM de dependencias.
2. **sonarqube** — analisis estatico y espera del Quality Gate.
3. **snyk** — vulnerabilidades en dependencias (`snyk test`) y en el codigo (`snyk code test`).
4. **iac** — `terraform fmt`, `terraform validate` y `snyk iac test`.
5. **docker** — build, prueba del contenedor, escaneo con Grype y Snyk Container, SBOM CycloneDX + SPDX,
   exporta la imagen como artefacto `.tar.gz` y la publica en GitHub Container Registry.
6. **deploy** — `terraform plan/apply` del stack completo en el runner, smoke tests, genera trafico,
   saca las capturas del dashboard y destruye el entorno (`terraform destroy`).
7. **deploy-vm** *(opcional)* — mismo despliegue, pero persistente, en la VM de VirtualBox con un runner self-hosted.

## Puesta en marcha

### 1. Subir el codigo a GitHub
```bash
git init -b main
git add .
git commit -m "Proyecto 1: BTC Tracker con CI/CD"
git remote add origin https://github.com/TU_USUARIO/btc-tracker.git
git push -u origin main
```

### 2. Configurar los controles de seguridad
- **SonarQube Cloud** (gratis para repos publicos): entrar a https://sonarcloud.io con GitHub, importar el repo,
  *desactivar "Automatic Analysis"* (usamos el del pipeline), y copiar `organization` y `projectKey` en
  `sonar-project.properties`. Crear el secret `SONAR_TOKEN`.
  Si usan un SonarQube propio, crear ademas la variable `SONAR_HOST_URL`.
- **Snyk**: crear cuenta en https://snyk.io, copiar el token (Account settings → Auth Token) en el secret `SNYK_TOKEN`.
  Para `snyk code test`, habilitar *Snyk Code* en la configuracion de la organizacion.

Los secrets van en *Settings → Secrets and variables → Actions*. Si falta alguno, el paso se omite con un warning
en lugar de romper el pipeline.

### 3. Ejecutar
Cada `push` a `main` dispara el pipeline completo; en los pull requests corre todo menos el push y el deploy.
Tambien se puede lanzar a mano desde *Actions → CI/CD BTC Tracker → Run workflow*.

Artefactos que quedan en cada corrida: `coverage`, `sbom-npm`, `sbom-image`, `docker-image` (la imagen `.tar.gz`)
y `capturas-dashboard`.

## Opcion local: Docker + Terraform en VirtualBox

Requisitos en tu PC: VirtualBox y Vagrant.

```bash
vagrant up            # crea la VM Ubuntu 24.04 con Docker y Terraform
vagrant ssh
cd /vagrant

# construir la imagen (o descargarla de GHCR: docker pull ghcr.io/TU_USUARIO/btc-tracker:latest)
docker build -t btc-tracker:latest .

cd terraform/local
cp terraform.tfvars.example terraform.tfvars   # editar password de Grafana y app_image
terraform init
terraform plan
terraform apply
```

Desde el navegador del host:
- App: http://localhost:3000
- Prometheus: http://localhost:9090 (Status → Targets: `btc-tracker` debe estar UP)
- Grafana: http://localhost:3001 (usuario `admin`, password de `terraform.tfvars`) → dashboard *BTC Tracker - Metricas basicas*

Para destruir: `terraform destroy`.

### Despliegue automatico a la VM (opcional)
1. En GitHub: *Settings → Actions → Runners → New self-hosted runner* (Linux) y seguir los comandos dentro de la VM,
   agregando la etiqueta `virtualbox` (`./config.sh ... --labels virtualbox`). Ejecutarlo como servicio (`sudo ./svc.sh install && sudo ./svc.sh start`).
2. Crear el secret `GRAFANA_ADMIN_PASSWORD` y la variable `DEPLOY_TO_VM = true`.
3. Crear el environment `local-vm` (*Settings → Environments*); se le puede agregar aprobacion manual.

## Desarrollo local sin VM
```bash
npm install
npm run lint && npm test
npm start                         # http://localhost:3000
# o el stack completo con Docker Compose:
GRAFANA_ADMIN_PASSWORD='algoSeguro123' docker compose up --build
```

## Endpoints de la app
| Ruta | Descripcion |
|---|---|
| `/` | Pagina web |
| `/api/price` | Cotizacion en JSON (cache de 30 s para respetar el rate limit de CoinGecko) |
| `/health` | Healthcheck (usado por Docker y Terraform) |
| `/metrics` | Metricas Prometheus |

Metricas propias: `btc_price{currency}`, `btc_change_24h_percent`, `btc_upstream_requests_total{result}`,
`btc_upstream_request_duration_seconds`, `http_requests_total`, `http_request_duration_seconds`,
mas las metricas estandar de proceso y de Node.js.

## Estructura
```
.github/workflows/ci-cd.yml    Pipeline
Dockerfile, .dockerignore      Imagen
src/, public/, tests/          Aplicacion y tests
terraform/local/               Infraestructura (IaC)
monitoring/                    Prometheus + Grafana (datasource y dashboard)
sbom/                          SBOM CycloneDX de dependencias
capturas/                      Capturas (web y dashboard)
Vagrantfile                    VM de VirtualBox con Docker + Terraform
docker-compose.yml             Stack para desarrollo
scripts/gen_dashboard.py       Genera el JSON del dashboard de Grafana
```

## Opcion nube (AWS)
El mismo enfoque aplica cambiando el provider: una instancia EC2 (o ECS Fargate) creada con `hashicorp/aws`,
un backend `s3` para el estado, y el pipeline autenticandose con OIDC (`aws-actions/configure-aws-credentials`)
en lugar de credenciales fijas.
