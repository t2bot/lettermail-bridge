if (window.location.hash && window.location.hash.length > 0) {
    processInput(window.location.hash.substring(1));
}

function makeLabel(ev) {
    ev.preventDefault();
    processInput(document.getElementById("targetBox").value);
}

function processInput(text) {
    if (!text) {
        return showError("Please enter a room address");
    }
    if (!text.startsWith("#") && !text.startsWith("!")) {
        return showError("Invalid room address");
    }
    if (text.indexOf(':') < 2) {
        return showError("Invalid room address");
    }
    window.location.hash = '#' + text;
    document.getElementById("target").innerText = text;
    document.getElementById("default").style.display = 'none';
    document.getElementById("label").style.display = 'block';
    QRCode.toCanvas(document.getElementById('qrcode'), 'https://matrix.to/#/' + text);
}

function showError(message) {
    Array.from(document.getElementsByClassName("error")).forEach(e => {
        e.innerText = message;
    });
}
