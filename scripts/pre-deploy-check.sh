#!/bin/bash
# Pre-deployment validation script
# Runs all checks before deployment to ensure production readiness

set -e  # Exit on error

echo "🚀 Running pre-deployment checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to run a check
run_check() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAILED=1
        return 1
    fi
}

# Function to run a check with output
run_check_with_output() {
    local name=$1
    local command=$2
    
    echo "Checking $name..."
    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ $name failed${NC}"
        echo ""
        FAILED=1
        return 1
    fi
}

# 1. Environment variable validation
echo "1. Validating environment variables..."
if npm run validate:env:strict; then
    echo -e "${GREEN}✓ Environment variables valid${NC}"
else
    echo -e "${RED}✗ Environment variable validation failed${NC}"
    FAILED=1
fi
echo ""

# 1.5. Check for Google Maps API key (optional but recommended)
echo "1.5. Checking Google Maps API key..."
if [ -f ".env.local" ]; then
    if grep -q "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=" .env.local && ! grep -q "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$" .env.local && ! grep -q "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key" .env.local; then
        echo -e "${GREEN}✓ Google Maps API key is configured${NC}"
    else
        echo -e "${YELLOW}⚠ Google Maps API key is not set${NC}"
        echo "   Google Maps will use fallback mode (less reliable)"
        echo "   Run 'npm run setup:google-maps' to configure (optional but recommended)"
        echo "   See docs/GOOGLE_MAPS_SETUP.md for details"
    fi
else
    echo -e "${YELLOW}⚠ .env.local file not found${NC}"
    echo "   Google Maps API key cannot be checked"
fi
echo ""

# 2. Type checking
run_check_with_output "Type checking" "npm run type-check"

# 3. Linting
run_check_with_output "Linting" "npm run lint"

# 4. Tests
run_check_with_output "Tests" "npm test"

# 5. Build check (skip if --skip-build flag is provided)
if [[ "$1" != "--skip-build" ]]; then
    echo "5. Testing build..."
    if npm run build > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${RED}✗ Build failed${NC}"
        echo "Run 'npm run build' to see detailed errors"
        FAILED=1
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ Skipping build check (--skip-build flag provided)${NC}"
    echo ""
fi

# Summary
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All pre-deployment checks passed!${NC}"
    echo ""
    echo "You are ready to deploy to production."
    exit 0
else
    echo -e "${RED}❌ Some pre-deployment checks failed${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    exit 1
fi
