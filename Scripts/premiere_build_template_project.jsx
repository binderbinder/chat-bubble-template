/*
  premiere_build_template_project.jsx  (Premiere Pro ExtendScript)
  Legt Premiere_Project/Chat_Bubble_Template.prproj neu an:
    - Sequenz CHAT_BEISPIEL (1920x1080, 30 fps)
    - V1 Hintergrund, V2-V6 Beispiel-Chat aus den beiden .mogrt-Vorlagen
  Erwartet: kein Projekt geoeffnet bzw. wird vom Aufrufer vorher geschlossen.
*/
(function () {
    var R = (typeof CB_ROOT !== "undefined") ? CB_ROOT : "/Users/dominikbinder/Documents/5BHITM/MEDTMT/BLASE_TEMPLATE";
    var PRESET = "/Applications/Adobe Premiere Pro 2027/Adobe Premiere Pro 2027.app/Contents/Settings/SequencePresets/Legacy/Digital SLR/1080p/DSLR 1080p30.sqpreset";
    var TICKS = 254016000000;
    var out = [];

    function T(s) { var t = new Time(); t.seconds = s; return t; }
    function findP(c, name) {
        for (var i = 0; i < c.properties.numItems; i++) if (c.properties[i].displayName.indexOf(name) === 0) return c.properties[i];
        out.push("Regler fehlt: " + name); return null;
    }
    // JSON-String mit \uXXXX fuer alle Nicht-ASCII-Zeichen (Umlaute kommen sonst falsch an)
    function jstr(s) {
        var r = '"';
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i), code = s.charCodeAt(i);
            if (ch === '"' || ch === "\\") r += "\\" + ch;
            else if (code < 32 || code > 126) { var h = code.toString(16); while (h.length < 4) h = "0" + h; r += "\\u" + h; }
            else r += ch;
        }
        return r + '"';
    }
    function setText(c, txt) {
        var p = findP(c, "Nachricht"); var j = eval("(" + p.getValue() + ")");
        j.textEditValue = txt; j.fontTextRunLength = [txt.length];
        var parts = [];
        for (var k in j) {
            var v = j[k], s;
            if (typeof v === "string") s = jstr(v);
            else if (v instanceof Array) { var a = []; for (var q = 0; q < v.length; q++) a.push(typeof v[q] === "string" ? jstr(v[q]) : String(v[q])); s = "[" + a.join(",") + "]"; }
            else s = String(v);
            parts.push(jstr(k) + ":" + s);
        }
        p.setValue("{" + parts.join(",") + "}", true);
    }

    var path = R + "/Premiere_Project/Chat_Bubble_Template.prproj";
    app.newProject(path);
    var seq = app.project.newSequence("CHAT_BEISPIEL", PRESET);
    var st = seq.getSettings(); var fr = new Time(); fr.ticks = String(TICKS / 30); st.videoFrameRate = fr; seq.setSettings(st); // echte 30 fps

    app.enableQE(); var qs = qe.project.getActiveSequence();
    if (seq.videoTracks.numTracks < 6) qs.addTracks(6 - seq.videoTracks.numTracks, seq.videoTracks.numTracks, 0);

    // Hintergrund in eigenen Ordner
    var binBg = app.project.rootItem.createBin("Hintergrund");
    app.project.importFiles([R + "/Assets/hintergrund_verlauf_hell.png"], true, binBg, false);
    var bg = binBg.children[0];
    seq.videoTracks[0].overwriteClip(bg, 0);
    seq.videoTracks[0].clips[0].end = T(10);

    var conv = [
        { f: "A", t: 0.0, text: "Hey, wie geht's?", x: 1517, y: 346 },
        { f: "B", t: 1.1, text: "Alles gut, und dir?", x: 403, y: 464, typing: 0.9 },
        { f: "A", t: 3.0, text: "Auch gut!", x: 1517, y: 582, notail: true },
        { f: "A", t: 3.6, text: "Was machst du heute?", x: 1517, y: 684 },
        { f: "B", t: 4.6, text: "Ich bin gerade unterwegs. Hast du am Wochenende Zeit? Ich hab eine Idee f\u00fcr unser n\u00e4chstes Projekt.", x: 403, y: 900, typing: 1.3 }
    ];
    for (var m = 0; m < conv.length; m++) {
        var M = conv[m];
        var ti = seq.importMGT(R + "/MOGRT/CHAT_BUBBLE_PERSON_" + M.f + ".mogrt", String(Math.round(M.t * TICKS)), m + 1, 0);
        if (!ti) { out.push("Import fehlgeschlagen: " + m); continue; }
        ti.end = T(10);
        var c = ti.getMGTComponent();
        setText(c, M.text);
        findP(c, "Position").setValue([M.x / 1920, M.y / 1080], true);
        if (M.notail) findP(c, "Zipfel").setValue(false, true);
        if (M.typing) { findP(c, "Tipp-Anzeige").setValue(true, true); findP(c, "Tipp-Dauer").setValue(M.typing, true); }
        out.push("V" + (m + 2) + " " + M.f + " @" + ti.start.seconds + "s: " + eval("(" + findP(c, "Nachricht").getValue() + ")").textEditValue);
    }
    app.project.save();
    out.push("gespeichert: " + app.project.path);
    return out.join("\n");
})();
