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
            },
            playType: 2, // screen share
        });
        let divId = createUserDiv('local-user-' + localStream.uid);
        await webrtc.play(localStream.uid, divId); // play local stream
        await webrtc.publish(); // publish local stream
        $invite.attr('href', `index.html?appid=${appId}&roomId=${roomId}`);
        $invite.show();
    } catch (e) {
        if (e && e.error) {
            warn(e.error);
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
}

$leave.click(() => {
    leave();
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

function getRandomUid() {
    return Math.random().toString(36).slice(-8);
}
