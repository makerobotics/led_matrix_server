#!/bin/sh


mosquitto_pub -h 192.168.2.201 -t "global/led" -m "CLR"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,0,0,255,0,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,1,0,255,0,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,2,0,255,0,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,3,0,255,0,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,4,0,255,0,0,"

mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,0,1,0,255,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,1,1,0,255,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,2,1,0,255,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,3,1,0,255,0,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,4,1,0,255,0,"

mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,0,2,0,0,255,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,1,2,0,0,255,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,2,2,0,0,255,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,3,2,0,0,255,"
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SET,4,2,0,0,255,"

mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SHOW"
sleep 1.0


mosquitto_pub -h 192.168.2.201 -t "global/led" -m "CLR"
while read x
do
    mosquitto_pub -h 192.168.2.201 -t "global/led" -m  $x
done < parameters.txt
mosquitto_pub -h 192.168.2.201 -t "global/led" -m "SHOW"
