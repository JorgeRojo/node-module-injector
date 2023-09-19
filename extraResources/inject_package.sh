#!/bin/sh

. "$(dirname "$0")/enable_node.sh"

## powershell ----   $env:Temp
## linux --- systemd-path temporary
## macos --- $TMPDIR

DEPENDENCY_NAME=$1
DEPENDENCY_PACKAGE_PATH=$2
TMP_DEPENDENCY_DIR=$3
TARGET_PACKAGE_DIR=$4

echo ""
echo ">>>---------- Injecting: $DEPENDENCY_NAME ----------<<<"
echo "> DEPENDENCY_PACKAGE_PATH: "$DEPENDENCY_PACKAGE_PATH
echo "> TMP_DEPENDENCY_DIR:      "$TMP_DEPENDENCY_DIR
echo "> TARGET_PACKAGE_DIR:      "$TARGET_PACKAGE_DIR

rm -r -f ${TMP_DEPENDENCY_DIR}

mkdir ${TMP_DEPENDENCY_DIR}

tar -xzf ${DEPENDENCY_PACKAGE_PATH} -C ${TMP_DEPENDENCY_DIR}

rm -r -f ${TARGET_PACKAGE_DIR}

mkdir ${TARGET_PACKAGE_DIR}

mv ${TMP_DEPENDENCY_DIR}/package/* ${TARGET_PACKAGE_DIR}

rm -r -f ${TMP_DEPENDENCY_DIR}
