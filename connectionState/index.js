'use strict';

let webrtc = null;
let joined = false;

let $invite = $("#invite");

let $appid = $("#appid");
let $roomId = $("#roomId");
let $uid = $("#uid");
let $token = $("#token");
let $leave = $("#leave");
let $join = $("#join");
let $getSignalConnectionState = $('#getSignalConnectionState');
let $getMediaConnectionState = $('#getMediaConnectionState');
let $users = $("#users");
let $message = $("#message");
let $form = $("form");

const url = new URL(window.location);
let uAppid = url.searchParams.get('appid');
let uRoomId = url.searchParams.get('roomId');
let uToken = url.searchParams.get('token');
$appid.val(uAppid);
$roomId.val(uRoomId);
$token.val(uToken);
$invite.hide();
$uid.val(getRandomUid());

if (uAppid && uRoomId) {
    join();
}

$form.submit(async function (e) {
    e.preventDefault();
    await join();
});

async function join() {
    try {
        if (joined) {
            return;
        }
        let appId = parseInt($appid.val());
        if (isNaN(appId)) {
            warn('AppId must be number');
            return;
        }
        webrtc = new WebRTC(); // create WebRTC object


        let err = webrtc.init(appId); // init
        if (err === null) {
            console.log('init success');
        } else {
            warn(err.error);
            return;
        }

        $getMediaConnectionState.attr('disabled', false);
        $getSignalConnectionState.attr('disabled', false);

        let roomId = $roomId.val();

        // register event callback
        webrtc.on('remote_stream_add', async (ev, remoteStream) => {
            // subscribe remote stream
            await webrtc.subscribe(remoteStream);

            // create div for remote stream
            let divId = createUserDiv('remote-user-' + remoteStream.uid);

            // play remote stream
            await webrtc.play(remoteStream.uid, divId);
        });

        webrtc.on('remote_stream_remove', async (ev, remoteStream) => {
            removeUserDiv('remote-user-' + remoteStream.uid);
        });

        webrtc.on('network_score', onNetworkScore);
        webrtc.on('connected', onConnected);
        webrtc.on('reconnect', onReconnected);

        $join.prop('disabled', true);

        let uid = $uid.val();
        let token = $token.val();
        if (token.length === 0) {
            token = undefined;
        }

        // join room
        await webrtc.joinRoom({
            uid: uid,
            roomId: roomId,
            token: token,
        });
        joined = true;
        $leave.attr('disabled', false);
        // create local stream
        let localStream = await webrtc.createStream({
            audio: true, // enable microphone
            video: {
                videoMode: 3, // HD VIDEO
            }
        });
        let divId = createUserDiv('local-user-' + localStream.uid);
        await webrtc.play(localStream.uid, divId); // play local stream
        await webrtc.publish(); // publish local stream
        $invite.attr('href', `index.html?appid=${appId}&roomId=${roomId}`);
        $invite.show();
    } catch (e) {
        if (e && e.error) {
            warn(e.error);
        } else {
            warn(JSON.stringify(e));
        }
        if (webrtc) {
            webrtc.leaveRoom();
            joined = false;
            $leave.attr('disabled', true);
            $join.prop('disabled', false);
        }
    }
}

function leave() {
    if (!joined) {
        return;
    }
    webrtc.leaveRoom();
    $users.empty();
    $join.prop('disabled', false);
    $leave.prop('disabled', true);
    $invite.hide();
    joined = false;
    updateNetworkScore(0, 0);
}

$leave.click(() => {
    leave();
});

// this will be called every two seconds
function onNetworkScore(ev, data) {
    updateNetworkScore(data.uplinkNetworkScore, data.downlinkNetworkScore);
}

function onConnected() {
    $('#network-event td:nth-child(2)').text('connected');
    $('#network-event').attr('class', 'success');
}

function onReconnected() {
    $('#network-event td:nth-child(2)').text('reconnected');
    $('#network-event').attr('class', 'danger');
}

updateNetworkScore(0, 0); // score 0 is unknown

function updateNetworkScore(upScore, downScore) {
    updateClassByScore($('#uplink-network-score'), upScore);
    updateClassByScore($('#downlink-network-score'), downScore);

    $('#uplink-network-score td:nth-child(2)').text(upScore);
    $('#downlink-network-score td:nth-child(2)').text(downScore);
}

function updateClassByScore(element, score) {
    if (score === 0) {
        // 0 is unknown
        element.attr('class', 'active');
    } else if (score === 1) {
        // 1 is good network
        element.attr('class', 'success');
    } else if (score < 5) {
        element.attr('class', 'warning');
    } else {
        element.attr('class', 'danger');
    }
}

$getSignalConnectionState.click(() => {
    if (webrtc) {
        let data = webrtc.getSignalConnectionState();
        let showInfo = `getSignalConnectionState: ${JSON.stringify(data)}`;
        if (data.result) {
            info(showInfo);
        } else {
            warn(showInfo);
        }
    } else {
        warn('create WebRTC first');
    }
});

$getMediaConnectionState.click(() => {
    if (webrtc) {
        let data = webrtc.getMediaConnectionState();
        if (data.result) {
            let showInfo = `getMediaConnectionState: {`;
            for (let [uid, state] of data.result.uplinkStateMap.entries()) {
                showInfo += ` ${uid}: ${state},`
            }
            for (let [uid, state] of data.result.downlinkStateMap.entries()) {
                showInfo += ` ${uid}: ${state},`
            }
            showInfo += `}`;
            info(showInfo);
        } else {
            warn(JSON.stringify(data));
        }
    } else {
        warn('create WebRTC first');
    }
});

function createUserDiv(name) {
    let div = $("<div class='user'></div>").attr('id', name);
    let mediaId = 'media-' + name;
    let mediaDiv = $("<div class='media'></div>").attr('id', mediaId);
    div.append(`<span class="label label-info">${name}</span>`);
    div.append(mediaDiv);
    $users.append(div);
    return mediaId;
}

function removeUserDiv(name) {
    $("#" + name).remove();
}

function warn(s) {
    $message.append(`<div class="alert alert-danger alert-dismissible" role="alert">
<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>${s}</div>`)
}

function info(s) {
    $message.append(`<div class="alert alert-success alert-dismissible" role="alert">
<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>${s}</div>`)
}

function getRandomUid() {
    return Math.random().toString(36).slice(-8);
}
