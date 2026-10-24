# -*- mode: ruby -*-
# Opcion local: VM de VirtualBox con Docker + Terraform.
#   vagrant up          -> crea y aprovisiona la VM
#   vagrant ssh         -> entra a la VM (el repo queda en /vagrant)
#   vagrant destroy -f  -> elimina la VM

Vagrant.configure("2") do |config|
  config.vm.box      = "bento/ubuntu-24.04"
  config.vm.hostname = "btc-devops"

  # Puertos accesibles desde el navegador del host
  config.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "127.0.0.1"  # App
  config.vm.network "forwarded_port", guest: 9090, host: 9090, host_ip: "127.0.0.1"  # Prometheus
  config.vm.network "forwarded_port", guest: 3001, host: 3001, host_ip: "127.0.0.1"  # Grafana

  config.vm.provider "virtualbox" do |vb|
    vb.name   = "btc-devops"
    vb.cpus   = 2
    vb.memory = 4096
  end

  config.vm.provision "shell", inline: <<-SHELL
    set -euxo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release unzip

    # Docker Engine (repositorio oficial)
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

    # Terraform (repositorio oficial de HashiCorp)
    curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /etc/apt/keyrings/hashicorp.gpg
    echo "deb [signed-by=/etc/apt/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin terraform

    usermod -aG docker vagrant
    systemctl enable --now docker

    # Directorio para el estado de Terraform del runner self-hosted
    mkdir -p /opt/btc-tracker && chown vagrant:vagrant /opt/btc-tracker

    docker --version
    terraform -version
  SHELL
end
