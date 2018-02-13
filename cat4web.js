/**
 * JS version: v.0.1.0.
 * Compatible with: v.0.1.0 CAT4Web.exe.
 *
 * Author R8ACC.
 * Homepage https://github.com/kikimor/cat4web
 * CAT4Web https://cat4web.r8acc.ru
 */
function CAT4Web() {
    this.MODE_CW_U = 0x00800000;
    this.MODE_CW_L = 0x01000000;
    this.MODE_SSB_U = 0x02000000;
    this.MODE_SSB_L = 0x04000000;
    this.MODE_DIG_U = 0x08000000;
    this.MODE_DIG_L = 0x10000000;
    this.MODE_AM = 0x20000000;
    this.MODE_FM = 0x40000000;
    this.STATUS_NOTCONFIGURED = 0x00000000;
    this.STATUS_DISABLED = 0x00000001;
    this.STATUS_PORTBUSY = 0x00000002;
    this.STATUS_NOTRESPONDING = 0x00000003;
    this.STATUS_ONLINE = 0x00000004;

    /**
     * Timeout between reconnect attempts.
     * @type {int}
     */
    this.reconnectTimeout = 5000;

    /**
     * WebSocket connection protocol. WS or WSS.
     * @type {boolean}
     */
    this.secureConnection = location.protocol === 'https:';

    var host = 'cat4web.localhost.r8acc.ru',
        socket = null,
        connectState = false,
        isActive = false,
        self = this,
        rigInfo = {};

    this.onConnect = function () {};
    this.onDisconnect = function () {};
    this.onChangeStatus = function (rig, status) {};
    this.onChangeFrequency = function (rig, frequency) {};
    this.onChangeMode = function (rig, mode) {};
    this.onChangePTT = function (rig, status) {};

    /**
     * Connection to CAT4Web server is active (established).
     * @returns {boolean}
     */
    this.isActive = function() {
        return isActive;
    };

    /**
     * Get current connect status to OmniRig server.
     * @param {int} rig
     * @returns {int}
     */
    this.getStatus = function(rig) {
        return getRigInfo(rig, 'status');
    };

    /**
     * Get current connect status to OmniRig server as string.
     * @param {int} rig
     * @returns {string}
     */
    this.getStatusText = function (rig) {
        switch (getRigInfo(rig, 'status')) {
            case self.STATUS_NOTCONFIGURED:
                return 'Rig is not configured';
            case self.STATUS_DISABLED:
                return 'Rig is disabled';
            case self.STATUS_PORTBUSY:
                return 'Port is not available';
            case self.STATUS_NOTRESPONDING:
                return 'Rig is not responding';
            case self.STATUS_ONLINE:
                return 'On-line';
        }
    };

    /**
     * Get current frequency in Hz.
     * @param {int} rig
     * @returns {int}
     */
    this.getFrequency = function(rig) {
        return getRigInfo(rig, 'frequency')
    };

    /**
     * Set frequency in Hz.
     * @param {int} rig
     */
    this.setFrequency = function(rig, value) {
        setRigInfo(rig, 'frequency', value);
        sendData(rig, 'freq', value);
    };

    /**
     * Get current modulation.
     * @param {int} rig
     * @returns {int}
     */
    this.getMode = function(rig) {
        return getRigInfo(rig, 'mode');
    };

    /**
     * Set current modulation.
     * @param {int} rig
     * @param {int} value
     */
    this.setMode = function(rig, value) {
        sendData(rig, 'mode', value);
    };

    /**
     * Get current PTT status.
     * @param {int} rig
     * @returns {boolean}
     */
    this.getPTT = function(rig) {
        return getRigInfo(rig, 'ptt') || false;
    };

    /**
     * Connect to CAT4Web server.
     * @returns {boolean}
     */
    this.connect = function () {
        if (typeof WebSocket !== 'function') {
            console.log('WebSocket not supported for you. Sorry.');
            return false;
        }

        if (!connectState) {
            connectState = true;
            socket = new WebSocket(this.secureConnection ? 'wss://' + host + ':34469' : 'ws://' + host + ':34468');
            socket.onopen = onOpen;
            socket.onclose = onClose;
            socket.onmessage = onMessage;
            return true;
        }

        return false;
    };

    /**
     * Disconnect from CAT4Web server.
     * @returns {*}
     */
    this.disconnect = function () {
        connectState = isActive = false;
        if (socket) {
            socket.close();
            return true;
        }
        return false;
    };

    /**
     * Action on open connect to CAT4Web server.
     */
    function onOpen() {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://cat4web.r8acc.ru/licence/request', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    socket.send('token:' + JSON.parse(xhr.responseText));
                } else {
                    socket.close();
                    console.log('Could not get access key. Send mail to i@r8acc.ru.')
                }
            }
        };
        xhr.send();
    }

    /**
     * Action on close connect to CAT4Web server.
     */
    function onClose() {
        self.onDisconnect();

        if (connectState) {
            connectState = false;
            setTimeout(function () {
                self.connect();
            }, self.reconnectTimeout);
        }
    }

    /**
     * Action on get message from CAT4Web server.
     */
    function onMessage(event) {
        var data = JSON.parse(event.data);

        if (data.auth === true) {
            isActive = true;
            self.onConnect();
        } else {
            switch (data.type) {
                case 'status':
                    setRigInfo(data.rig, 'status', data.value !== null ? parseInt(data.value) : null);
                    self.onChangeStatus(data.rig, rigInfo[data.rig].status);
                    break;
                case 'freq':
                    setRigInfo(data.rig, 'frequency', data.value !== null ? parseInt(data.value) : null);
                    self.onChangeFrequency(data.rig, getRigInfo(data.rig, 'frequency'));
                    break;
                case 'mode':
                    setRigInfo(data.rig, 'mode', data.value !== null ? parseInt(data.value) : null);
                    self.onChangeMode(data.rig, getRigInfo(data.rig, 'mode'));
                    break;
                case 'ptt':
                    setRigInfo(data.rig, 'ptt', !!data.value);
                    self.onChangePTT(data.rig, getRigInfo(data.rig, 'ptt'));
                    break;
            }
        }

    }

    /**
     * Send data to CAT4Web server.
     * @param {int} rig
     * @param {string} param
     * @param {string|int} value
     */
    function sendData(rig, param, value) {
        if (connectState) {
            socket.send(rig + ':' + param + ':' + value);
        }
    }

    /**
     * Get rig value from cache.
     * @param {int} rig
     * @param {string} attribute
     * @returns {*}
     */
    function getRigInfo(rig, attribute) {
        if (rig && rigInfo[rig]) {
            return rigInfo[rig][attribute];
        }
        return null
    }

    /**
     * Write rig attribute in cache variable.
     * @param {int} rig
     * @param {string} attribute
     * @param {*} value
     */
    function setRigInfo(rig, attribute, value) {
        if (rig) {
            if (!rigInfo[rig]) {
                rigInfo[rig] = {};
            }
            rigInfo[rig][attribute] = value;
        }
    }
}
