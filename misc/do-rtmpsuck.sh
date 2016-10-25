#!/bin/bash

# enable internal port forwarding:
sudo sysctl -w net.inet.ip.forwarding=1

# apply the pf rules:
echo '
rdr pass log on lo0 proto tcp from en0 to any port 1935 -> 127.0.0.1
pass out on en0 route-to lo0 inet proto tcp from en0 to any port 1935 keep state user != root
' | sudo pfctl -ef -

# check the pf rules:
# sudo pfctl -s all
say "starting r-t-m-p-suck";

sudo rtmpsuck $@;

say "r-t-m-p-suck Stopped.";

# clear the pf rules:
echo ''
echo ''
echo "====== restting pfctl rules ======="
echo ''

sudo pfctl -F all -f /etc/pf.conf