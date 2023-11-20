#!/bin/bash

. "$(dirname "$0")/helpers/global.sh"

EXTRA_RESOURCES_DIR=$(dirname "$0")
NODE_PI_FILE_PREFIX=$1
shift

echo ">>------------ KILL ALL START ------------<<"

## ---- kill node open processes ----

getSubScriptClean() {
  echo "$1" | sed -e "s/^[[:space:]]*//" | tr -d '"' | tr -d "'"
}

getSubScriptPIDs() {
  if [[ "$(uname)" == "Darwin" ]]; then
    ps -A | grep -E -i "node.*$1" | grep -v "grep" | grep -v "&&" | awk "{ print \$1 }"
  else
    ps aux | grep -E -i "node.*$1" | grep -v "grep" | grep -v "&&" | awk "{ print \$2 }"
  fi
}

for script in "$@"; do
  while IFS= read -r subScript; do
    cleanSubScript=$(getSubScriptClean "$subScript")
    nodePids=$(getSubScriptPIDs "$cleanSubScript")
    if [[ -n "$nodePids" ]]; then
      echo ">> NodeJS script PIDs ---- $script"
      for pid in $nodePids; do
        echo "kill PID: $pid"
        kill -SIGKILL $pid &>/dev/null
        kill $pid &>/dev/null
      done
    fi
  done <<<"$(echo "$script" | sed -e "s/&&/\n/g")"
done

## ---- kill bash open processes ----

NODE_PI_PIDS_INC="(node-package-injector|NodePI|vite|craco).*$NODE_PI_FILE_PREFIX"
NODE_PI_PIDS_EXC="grep|node_pi_reset_all|node_pi_kill_all"

if [[ "$(uname)" == "Darwin" ]]; then
  NODE_PI_PIDS=$(ps -A | grep -E -i $NODE_PI_PIDS_INC | grep -E -i -v $NODE_PI_PIDS_EXC | awk '{ print $1 }')
else
  NODE_PI_PIDS=$(ps aux | grep -E -i $NODE_PI_PIDS_INC | grep -E -i -v $NODE_PI_PIDS_EXC | awk '{ print $2 }')
fi

if [[ -n "$NODE_PI_PIDS" ]]; then
  echo ">> NodePI direct PIDs ----"
  for pid in $NODE_PI_PIDS; do
    echo "kill PID: $pid"
    kill -SIGKILL $pid &>/dev/null
    kill $pid &>/dev/null
  done
fi

echo ">>------------ KILL ALL FINISHED ---------<<"
echo ""
