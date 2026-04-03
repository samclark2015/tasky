#!/usr/bin/env bash
#
# Generate a self-signed code-signing certificate for macOS.
# The resulting .p12 file can be base64-encoded and stored as a GitHub secret.
#
# Usage:
#   ./scripts/generate-signing-cert.sh
#
# Outputs:
#   ./tasky-codesign.p12  - PKCS12 certificate bundle
#
# After running, add these GitHub secrets:
#   MACOS_CERTIFICATE          - base64 -i tasky-codesign.p12 | pbcopy
#   MACOS_CERTIFICATE_PASSWORD - the password you entered during generation
#

set -euo pipefail

CERT_NAME="Tasky Self-Signed"
KEY_FILE="tasky-codesign.key"
CERT_FILE="tasky-codesign.crt"
P12_FILE="tasky-codesign.p12"
DAYS_VALID=3650  # ~10 years

echo "=== Generating self-signed code-signing certificate ==="
echo ""

# 1. Generate a private key
echo "Generating RSA private key..."
openssl genrsa -out "$KEY_FILE" 2048

# 2. Create a config file for the certificate with codesigning extensions
CONFIG_FILE=$(mktemp)
cat > "$CONFIG_FILE" <<EOF
[req]
distinguished_name = req_dn
prompt = no

[req_dn]
CN = ${CERT_NAME}
O = Tasky
OU = Development

[v3_codesign]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
basicConstraints = critical, CA:false
EOF

# 3. Generate the self-signed certificate with code-signing extensions
echo "Generating self-signed certificate (valid for $DAYS_VALID days)..."
openssl req -new -x509 \
  -key "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days "$DAYS_VALID" \
  -config "$CONFIG_FILE" \
  -extensions v3_codesign

rm -f "$CONFIG_FILE"

# 4. Bundle into a .p12 file
echo ""
echo "Bundling into PKCS12 (.p12) file..."
echo "You will be prompted for an export password. Remember it for the GitHub secret."
echo ""
openssl pkcs12 -export \
  -in "$CERT_FILE" \
  -inkey "$KEY_FILE" \
  -out "$P12_FILE" \
  -name "$CERT_NAME"

# 5. Clean up intermediate files
rm -f "$KEY_FILE" "$CERT_FILE"

echo ""
echo "=== Done ==="
echo ""
echo "Certificate generated: $P12_FILE"
echo ""
echo "Next steps:"
echo "  1. Base64-encode and copy to clipboard:"
echo "       base64 -i $P12_FILE | pbcopy"
echo ""
echo "  2. Add these GitHub repository secrets:"
echo "       MACOS_CERTIFICATE          = (paste the base64 string)"
echo "       MACOS_CERTIFICATE_PASSWORD = (the password you just entered)"
echo ""
echo "  3. (Optional) Import into your local keychain for local signing:"
echo "       security import $P12_FILE -k ~/Library/Keychains/login.keychain-db"
