#!/usr/bin/env python

import time
import schedule
from datetime import datetime
import logging
from threading import Thread
from random import randrange
import paho.mqtt.client as mqtt
from tornado.options import options, define, parse_command_line
import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.wsgi
import tornado.websocket
import json
import os.path
import signal
import base64
import hashlib

MQTT_IP = "192.168.2.201"

try:
    import cStringIO as io
except ImportError:
    import io

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
#logger.setLevel(logging.DEBUG)

define('port', type=int, default=8080)

# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))

class Control(Thread):
    def __init__(self):
        Thread.__init__(self)
        self._running = True
        self.seq = None
        self.automatic = False
        self.nextEyeBlink = 0
        self.nextEyeSwitch = 0
        self.nextPupilMove = 0
        self.eyeColor = 1 #1: GREEN, 2: RED
        self.pupil_index = 0
        self.pupil_x = 2 # 3 centre
        self.pupil_y = 4
        schedule.every(1).minutes.do(self.job_time)

    def terminate(self):
        self._running = False

    def job_time(self):
        now = datetime.now() # current date and time
        time_string = now.strftime("%H:%M")
        if(now.hour > 17 or now.hour < 8):
            client.publish("global/led", '{"text":"'+time_string+'", "delay":150, "fg":"0,0,200,"}')
        else:
            client.publish("global/led", '{"text":"'+time_string+'", "delay":150, "fg":"200,200,200,"}')
        #print('{"text":"'+time_string+'", "delay":200, "fg":"0,0,200,"}')

    def eyeManager(self):
        pupil_move = [(2,4), (3,4), (4,4), (3,4)]
        now = round(time.time())
        if(self.nextEyeBlink < now):
            client.publish("global/led", "BLINK")
            self.nextEyeBlink = now + randrange(0, 3)
        elif(self.nextEyeSwitch < now):
            if(self.eyeColor == 1):
                client.publish("global/led", "RED")
                self.eyeColor = 0
            else:
                client.publish("global/led", "GREEN")
                self.eyeColor = 1
            self.nextEyeSwitch = now + randrange(6, 10)
        elif(self.nextPupilMove < now):
            self.pupil_x = pupil_move[self.pupil_index][0]
            self.pupil_y = pupil_move[self.pupil_index][1]
            client.publish("global/led", "PUPIL,"+str(self.pupil_x)+","+str(self.pupil_y)+",")
            self.pupil_index += 1
            if(self.pupil_index>=len(pupil_move)):
                self.pupil_index = 0
            self.nextPupilMove = now + randrange(0, 2)

    def run(self):
        logger.debug('Control thread running')
        while self._running:
            if self.seq == None:
                time.sleep(0.05)
                self.eyeManager()
                if self.automatic == True:
                    schedule.run_pending()
            else:
                #
                jsonstring = {}
                jsonstring["cmd"] = "SeqDef"
                jsonstring["FrmCnt"] = len(self.seq["slides"])
                client.publish("global/led", json.dumps(jsonstring))


                i = 0
                for slides in self.seq["slides"]:
                    jsonstring = {}
                    jsonstring["cmd"] = "FrmDef"
                    jsonstring["FrmDelay"] = slides["delay"]
                    jsonstring["FrmIdx"] = i
                    jsonstring["PixCnt"] = len(slides["pixels"])
                    client.publish("global/led", json.dumps(jsonstring))

                    j = 0
                    for pixel in slides["pixels"]:
                        jsonstring = {}
                        jsonstring["cmd"] = "PixDef"
                        jsonstring["FrmIdx"] = i
                        pix = pixel.split(",")
                        jsonstring["X"] = int(pix[0])
                        jsonstring["Y"] = int(pix[1])
                        jsonstring["R"] = int(pix[2])
                        jsonstring["G"] = int(pix[3])
                        jsonstring["B"] = int(pix[4])

                        client.publish("global/led", json.dumps(jsonstring))
                        j += 1
                    i += 1
                client.publish("global/led", '{"cmd":"Start"}')
                # loaded
                self.seq = None
            ### Wait for command (call of runCommand by rpibot.py)
            #self.idleTask()
        #self.close()
        logger.debug('Control thread terminating')

class Application(tornado.web.Application):
    def __init__(self):
        handlers = [(r"/", webServerHandler), (r"/", MyStaticFileHandler), (r"/websocket", MyWebSocket)]
        settings = dict(
            static_path=os.path.join(os.path.dirname(__file__), "static"),
        )
        super(Application, self).__init__(handlers, **settings)

class MyStaticFileHandler(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        # Disable cache
        self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')

class webServerHandler(tornado.web.RequestHandler):
    def get(self):
        # render the html page, the socket is related to different domain
        self.render("index.html")

class MyWebSocket(tornado.websocket.WebSocketHandler):

    def check_origin(self, origin):
        return True

    def open(self):
        logger.info("WebSocket opened")

    def on_message(self, message):
        logger.debug("Server WS msg received: "+ message+"\n")
        #c.seq = None
        #client.publish("global/led", message)
        # SEQUENCE as json string
        if("text" in message):
            client.publish("global/led", message)
            c.automatic = False
        elif("AUTOMATIC" in message):
            c.automatic = True
            client.publish("global/led", '{"text":"OK...", "delay":150, "fg":"150,150,150,"}')
            #print("Received AUTOMATIC")
        else:
            c.automatic = False
            try:
                obj = json.loads(message)
                c.seq = obj
            except:
                # PICTURE as pixel (CLR and SHOW are managed by javascript)
                client.publish("global/led", message)

    def on_close(self):
        logger.info("WebSocket closed")

def main():
    interrupted = False
    tornado.options.parse_command_line() # this is calling the tornado logging settings
    app = Application()
    app.listen(options.port)

    try:
        tornado.ioloop.IOLoop.instance().start()
        logger.debug("Tornado loop start() finished")
    except KeyboardInterrupt:
        tornado.ioloop.IOLoop.instance().stop()
        logger.debug("User interrupt (main)")
        interrupted = True
    logger.debug("Main terminated with interrupt = " + str(interrupted))
    return interrupted

# This is the main application to be called to run the whole robot
if __name__ == '__main__':
    try:
        client = mqtt.Client()
        client.on_connect = on_connect
#        client.on_message = on_message
        client.connect(MQTT_IP, 1883, 60)
        client.loop_start()

        c = Control()
        c.start()

        while(1):
            logger.info("Starting web server")
            interrupted = main()
            if(interrupted == True):
                break
        c.terminate()
        c.join()
        # Signal termination
        logger.info("User interrupt")
        client.loop_stop()
        logger.debug("Main loop finished (__main__")
        # Wait for actual termination (if needed)
        logger.info("terminated")

    except KeyboardInterrupt:
        print "Finished"
        client.loop_stop()
