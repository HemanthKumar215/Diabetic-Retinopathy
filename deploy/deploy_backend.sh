#!/bin/bash
# =============================================================
# deploy_backend.sh — Run this from YOUR LOCAL machine (Windows Git Bash / WSL)
# Replace DROPLET_IP with your actual DigitalOcean IP
# =============================================================

DROPLET_IP="YOUR_DROPLET_IP"   # <-- CHANGE THIS
BACKEND_DIR="c:/Downloads/Minor_Project/backend"
MODEL_PATH="c:/Downloads/Minor_Project/vit_dr_final.pth"

echo "Uploading backend files to DigitalOcean..."

# Upload backend source code
scp -r "$BACKEND_DIR"/* root@$DROPLET_IP:/app/backend/

# Upload model file (343 MB — takes a minute)
echo "Uploading model (343 MB)..."
scp "$MODEL_PATH" root@$DROPLET_IP:/app/

echo "Restarting FastAPI service..."
ssh root@$DROPLET_IP "cd /app/backend && source venv/bin/activate && pip install -r requirements.txt && systemctl restart retinaflow"

echo ""
echo "Done! Test your API at: http://$DROPLET_IP/docs"
