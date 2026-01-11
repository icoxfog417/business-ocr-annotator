#!/bin/bash
# Build and deploy sharp Lambda layer for Node.js 20.x (linux-x64)

set -e

LAYER_NAME="sharp-layer"
REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

echo "Building sharp Lambda layer..."

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/nodejs"

# Install sharp with linux-x64 binaries
cd "$BUILD_DIR/nodejs"
npm init -y > /dev/null
npm install --cpu=x64 --os=linux sharp@0.33.2

# Create zip
cd "$BUILD_DIR"
zip -r "$SCRIPT_DIR/sharp-layer.zip" nodejs

# Deploy to Lambda
echo "Deploying layer to AWS Lambda..."
LAYER_VERSION=$(aws lambda publish-layer-version \
  --layer-name "$LAYER_NAME" \
  --description "Sharp image processing library for Node.js 20" \
  --zip-file "fileb://$SCRIPT_DIR/sharp-layer.zip" \
  --compatible-runtimes nodejs20.x \
  --compatible-architectures x86_64 \
  --region "$REGION" \
  --query 'Version' \
  --output text)

echo "Deployed $LAYER_NAME version $LAYER_VERSION"
echo "ARN: arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):layer:$LAYER_NAME:$LAYER_VERSION"

# Cleanup
rm -rf "$BUILD_DIR"
echo "Done."
