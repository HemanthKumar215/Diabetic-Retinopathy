#!/bin/bash
# =============================================================
# RetinaFlow-AR — DigitalOcean Droplet Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 droplet as root
# =============================================================

set -e
echo "=============================="
echo " RetinaFlow-AR Server Setup"
echo "=============================="

# 1. System update
echo "[1/8] Updating system..."
apt-get update -y && apt-get upgrade -y

# 2. Install Python & tools
echo "[2/8] Installing Python 3.11 & tools..."
apt-get install -y python3.11 python3.11-venv python3-pip nginx git curl ufw libgl1

# 3. Create app user & directory
echo "[3/8] Creating app directory..."
mkdir -p /app/backend
mkdir -p /app/backend/static/uploads
mkdir -p /app/backend/static/heatmaps

# 4. Copy backend files (run from your local machine via scp separately)
echo "[4/8] Skipping file copy (done via scp from local machine)..."

# 5. Python virtual environment
echo "[5/8] Creating virtual environment..."
cd /app/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 6. Create systemd service for FastAPI
echo "[6/8] Creating systemd service..."
cat > /etc/systemd/system/retinaflow.service << 'EOF'
[Unit]
Description=RetinaFlow-AR FastAPI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/app/backend
ExecStart=/app/backend/venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable retinaflow
systemctl start retinaflow

# 7. Configure Nginx as reverse proxy
echo "[7/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/retinaflow << 'EOF'
server {
    listen 80;
    server_name _;

    # Allow large file uploads (fundus images)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    location /static/ {
        alias /app/backend/static/;
        expires 1h;
        add_header Cache-Control "public";
    }
}
EOF

ln -sf /etc/nginx/sites-available/retinaflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 8. Firewall
echo "[8/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=============================="
echo " Setup Complete!"
echo " API running at http://<YOUR_DROPLET_IP>"
echo "=============================="
