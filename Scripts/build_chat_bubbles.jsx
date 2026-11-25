/*
  build_chat_bubbles.jsx
  Baut in After Effects die Chat-Bubble-Templates (Design C "Minimal Premium"):
    - CHAT_BUBBLE_PERSON_A  (blau, rechts, Zipfel rechts)
    - CHAT_BUBBLE_PERSON_B  (grau, links, Zipfel links)
  exportiert sie als .mogrt und rendert eine Vorschau-Unterhaltung.

  Ausfuehren: After Effects 2027 > Datei > Skripte > Skriptdatei ausfuehren...
  (Voraussetzung: Einstellungen > Skripterstellung und Ausdruecke >
   "Skripten das Schreiben von Dateien ... erlauben", Schrift Inter installiert)
*/
(function () {
    var ROOT_DIR = new File($.fileName).parent.parent.fsName;
    var LOGF = new File($.global.CB_LOG ? $.global.CB_LOG : (Folder.temp.fsName + "/chat_bubble_build_log.txt"));
    function log(s) { LOGF.encoding = "UTF-8"; LOGF.open("a"); LOGF.write(String(s) + "\n"); LOGF.close(); }

    var DO_RENDER = ($.global.CB_RENDER !== false);

    // ---------------- Design-Tokens (Design C) ----------------
    var FONT = "Inter-Regular", FONT_SIZE = 38, LEADING = 49, TRACKING = -12;
    var BOX_W = 760, BOX_H = 800;           // max. Textbreite 760 px
    var COMP_W = 1920, COMP_H = 1080, FPS = 30, DUR = 10, INTRO_PROTECT = 4;
    function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }

    var SIDES = {
        A: { name: "CHAT_BUBBLE_PERSON_A", dir: 1, fill: hex("#2A7AF5"), text: hex("#FFFFFF"), dots: hex("#FFFFFF"),
             stroke: false, pos: [1517, 600], sample: "Hey, wie geht's?" },
        B: { name: "CHAT_BUBBLE_PERSON_B", dir: -1, fill: hex("#F3F3F5"), text: hex("#111216"), dots: hex("#8E8E93"),
             stroke: true, pos: [403, 600], sample: "Alles gut, und dir?" }
    };

    // ---------------- Expressions ----------------
    // Gemeinsamer Kern: liest Regler, misst den Text, berechnet Groesse + Animationsfortschritt.
    function core(dir) {
        return [
            "var C=thisComp.layer('CONTROLS');",
            "var dir=" + dir + ";",
            "var typing=C.effect('Tippen')(1).value>0;",
            "var tailOn=C.effect('Zipfel')(1).value>0;",
            "var tDur=typing?Math.max(0.3,C.effect('Tippdauer')(1).value):0;",
            "function cl(x){return Math.min(Math.max(x,0),1);}",
            "function eo(x){x=cl(x);return x>=1?1:1-Math.pow(2,-10*x);}",
            "function ec(x){x=cl(x);return 1-Math.pow(1-x,3);}",
            "var a=eo(time/0.7);",
            "var r=thisComp.layer('TEXT').sourceRectAtTime(time,false);",
            "var tw=Math.max(r.width,1);",
            "var n=1; if(r.height>0){n=Math.max(1,Math.round((r.top+r.height+372.4-4)/49)+1);}",
            "var W=tw+76, H=27.6+(n-1)*49+68.4;",
            "var Wt=116, Ht=96;",
            "var m=typing?ec((time-tDur)/0.5):1;",
            "var cW=Wt+(W-Wt)*m, cH=Ht+(H-Ht)*m;",
            "var ti=eo((time-(typing?tDur+0.3:0.2))/0.45);"
        ].join("\n");
    }

    function pathExpr(dir) {
        return core(dir) + "\n" + [
            "var w=cW, h=cH;",
            "var R=Math.min(49,h/2,w/2); var k=0.5523*R;",
            "var P=[],I=[],O=[];",
            "function v(x,y,ix,iy,ox,oy){P.push([x*dir,y]);I.push([ix*dir,iy]);O.push([ox*dir,oy]);}",
            "v(-w+R,-h,-k,0,0,0);",
            "v(-R,-h,0,0,k,0);",
            "v(0,-h+R,0,-k,0,0);",
            "if(tailOn){",
            "  v(0,-23,0,0,0,12.65);",
            "  v(7.125,0,-4.75,-2.875,-5.095,0.54);",
            "  v(-7.3,-2.9,4.24,2.44,-2.83,1.95);",
            "  v(-17,0,3.44,0,0,0);",
            "}else{",
            "  v(0,-R,0,0,0,k);",
            "  v(-R,0,k,0,0,0);",
            "}",
            "v(-w+R,0,0,0,-k,0);",
            "v(-w,-R,0,k,0,0);",
            "v(-w,-h+R,0,0,0,-k);",
            "createPath(P,I,O,true);"
        ].join("\n");
    }

    // ---------------- Helpers ----------------
    function fx(layer, matchName, name) {
        var e = layer.property("ADBE Effect Parade").addProperty(matchName);
        e.name = name; return e;
    }

    function buildBubble(side) {
        var S = SIDES[side];
        var comp = app.project.items.addComp(S.name, COMP_W, COMP_H, 1, DUR, FPS);
        comp.bgColor = [0, 0, 0];

        // --- CONTROLS (Regler fuer Essential Graphics) ---
        var C = comp.layers.addNull(); C.name = "CONTROLS"; C.enabled = false;
        var ePos = fx(C, "ADBE Point Control", "Position"); ePos.property(1).setValue(S.pos);
        var eTail = fx(C, "ADBE Checkbox Control", "Zipfel"); eTail.property(1).setValue(1);
        var eTyp = fx(C, "ADBE Checkbox Control", "Tippen"); eTyp.property(1).setValue(0);
        var eTD = fx(C, "ADBE Slider Control", "Tippdauer"); eTD.property(1).setValue(1.2);
        var eSz = fx(C, "ADBE Slider Control", "Groesse"); eSz.property(1).setValue(100);

        // --- ROOT (Ankerpunkt = Ecke am Zipfel, traegt Einblend-Bewegung) ---
        var R = comp.layers.addNull(); R.name = "ROOT"; R.enabled = false;
        R.transform.anchorPoint.setValue([0, 0]);
        R.transform.position.expression = [
            "var C=thisComp.layer('CONTROLS');",
            "function eo(x){x=Math.min(Math.max(x,0),1);return x>=1?1:1-Math.pow(2,-10*x);}",
            "var a=eo(time/0.7); var p=C.effect('Position')(1).value;",
            "[p[0], p[1]+40*(1-a)]"].join("\n");
        R.transform.scale.expression = [
            "var C=thisComp.layer('CONTROLS');",
            "function eo(x){x=Math.min(Math.max(x,0),1);return x>=1?1:1-Math.pow(2,-10*x);}",
            "var a=eo(time/0.7); var s=C.effect('Groesse')(1).value*(0.94+0.06*a);",
            "[s,s]"].join("\n");

        // --- BUBBLE (eine Form inkl. Zipfel) ---
        var B = comp.layers.addShape(); B.name = "BUBBLE";
        B.setParentWithJump(R); B.transform.scale.setValue([100, 100]); B.transform.position.setValue([0, 0]); B.transform.anchorPoint.setValue([0, 0]);
        var grp = B.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); grp.name = "Bubble";
        var vecs = grp.property("ADBE Vectors Group");
        var pth = vecs.addProperty("ADBE Vector Shape - Group"); pth.name = "Form";
        pth.property("ADBE Vector Shape").expression = pathExpr(S.dir);
        if (S.stroke) {
            var st = vecs.addProperty("ADBE Vector Graphic - Stroke"); st.name = "Haarlinie";
            st.property("ADBE Vector Stroke Color").setValue([0, 0, 0, 1]);
            st.property("ADBE Vector Stroke Width").setValue(1.5);
            st.property("ADBE Vector Stroke Opacity").setValue(7);
        }
        var fl = vecs.addProperty("ADBE Vector Graphic - Fill"); fl.name = "Farbe";
        fl.property("ADBE Vector Fill Color").setValue([S.fill[0], S.fill[1], S.fill[2], 1]);
        var ds = B.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow"); ds.name = "Schatten";
        ds.property(1).setValue(hex("#0A1428").concat([1]));
        ds.property(2).setValue(255 * 0.16);
        ds.property(3).setValue(180);
        ds.property(4).setValue(14);
        ds.property(5).setValue(44);
        B.transform.opacity.expression = core(S.dir) + "\n100*a;";

        // --- TYPING_DOTS ---
        var D = comp.layers.addShape(); D.name = "TYPING_DOTS";
        D.setParentWithJump(R); D.transform.scale.setValue([100, 100]); D.transform.position.setValue([0, 0]); D.transform.anchorPoint.setValue([0, 0]);
        for (var i = 0; i < 3; i++) {
            var g = D.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = "Punkt " + (i + 1);
            var gv = g.property("ADBE Vectors Group");
            var el = gv.addProperty("ADBE Vector Shape - Ellipse"); el.property("ADBE Vector Ellipse Size").setValue([13, 13]);
            var gf = gv.addProperty("ADBE Vector Graphic - Fill"); gf.property("ADBE Vector Fill Color").setValue([S.dots[0], S.dots[1], S.dots[2], 1]);
            var tr = g.property("ADBE Vector Transform Group");
            tr.property("ADBE Vector Position").setValue([S.dir * (-58 + (i - 1) * 20), -48]);
            tr.property("ADBE Vector Group Opacity").expression = "var v=0.5+0.5*Math.sin(time*7-" + i + "*0.9); 35+65*v;";
            tr.property("ADBE Vector Scale").expression = "var v=0.5+0.5*Math.sin(time*7-" + i + "*0.9); var s=88+12*v; [s,s];";
        }
        D.transform.opacity.expression = core(S.dir) + "\ntyping ? 100*a*(1-cl((time-tDur)/0.15)) : 0;";

        // --- TEXT ---
        var T = comp.layers.addBoxText([BOX_W, BOX_H]); T.name = "TEXT";
        var tp = T.property("Source Text"); var d = tp.value;
        d.text = S.sample; d.font = FONT; d.fontSize = FONT_SIZE; d.autoLeading = false; d.leading = LEADING; d.tracking = TRACKING;
        d.applyFill = true; d.fillColor = S.text; d.justification = ParagraphJustification.LEFT_JUSTIFY;
        tp.setValue(d);
        T.setParentWithJump(R); T.transform.scale.setValue([100, 100]); T.transform.anchorPoint.setValue([0, 0]);
        T.transform.position.expression = core(S.dir) + "\n" + [
            "var x = dir>0 ? (-W+38-r.left) : (38-r.left);",
            "[x, -H+34+400+7*(1-ti)]"].join("\n");
        T.transform.opacity.expression = core(S.dir) + "\n100*a*ti;";

        // Ebenenreihenfolge: TEXT oben, dann DOTS, BUBBLE, ROOT, CONTROLS
        T.moveToBeginning(); D.moveAfter(T); B.moveAfter(D); R.moveAfter(B); C.moveAfter(R);

        // Intro vor Zeitdehnung schuetzen
        var mv = new MarkerValue("Intro (geschuetzt)"); mv.duration = INTRO_PROTECT; mv.protectedRegion = true;
        comp.markerProperty.setValueAtTime(0, mv);

        // Essential Graphics
        comp.motionGraphicsTemplateName = S.name;
        // Referenzen neu holen (AE invalidiert sie beim Hinzufuegen weiterer Effekte)
        C = comp.layer("CONTROLS");
        ePos = C.effect("Position"); eTail = C.effect("Zipfel"); eTyp = C.effect("Tippen");
        eTD = C.effect("Tippdauer"); eSz = C.effect("Groesse");
        tp = comp.layer("TEXT").property("Source Text");
        // AE stellt neu hinzugefuegte Regler nach oben -> umgekehrte Reihenfolge, damit "Nachricht" oben steht
        eSz.property(1).addToMotionGraphicsTemplateAs(comp, "Größe (%)");
        eTD.property(1).addToMotionGraphicsTemplateAs(comp, "Tipp-Dauer (Sek.)");
        eTyp.property(1).addToMotionGraphicsTemplateAs(comp, "Tipp-Anzeige …");
        eTail.property(1).addToMotionGraphicsTemplateAs(comp, "Zipfel anzeigen");
        ePos.property(1).addToMotionGraphicsTemplateAs(comp, "Position (Ecke am Zipfel)");
        tp.addToMotionGraphicsTemplateAs(comp, "Nachricht");
        return comp;
    }

    // Hoehe einer Blase (fuer Layout der Vorschau) - gleiche Formel wie in den Expressions
    function bubbleH(comp) {
        var r = comp.layer("TEXT").sourceRectAtTime(0, false);
        var n = 1; if (r.height > 0) n = Math.max(1, Math.round((r.top + r.height + 372.4 - 4) / 49) + 1);
        return 27.6 + (n - 1) * 49 + 68.4;
    }

    function setText(comp, txt) {
        var tp = comp.layer("TEXT").property("Source Text"); var d = tp.value; d.text = txt; tp.setValue(d);
    }

    function buildPreview(baseA, baseB, folder) {
        var conv = [
            { who: "A", t: 0.3, text: "Hey, wie geht's?" },
            { who: "B", t: 1.4, text: "Alles gut, und dir?", typing: 0.9 },
            { who: "A", t: 3.3, text: "Auch gut!", grouped: true },
            { who: "A", t: 3.9, text: "Was machst du heute?" },
            { who: "B", t: 4.9, text: "Ich bin gerade unterwegs. Hast du am Wochenende Zeit? Ich hab eine Idee für unser nächstes Projekt.", typing: 1.3 }
        ];
        var pv = app.project.items.addComp("PREVIEW_CHAT", COMP_W, COMP_H, 1, 10, FPS);
        pv.parentFolder = folder;
        var bg = pv.layers.addSolid([0.95, 0.955, 0.97], "BG", COMP_W, COMP_H, 1);
        var ramp = bg.property("ADBE Effect Parade").addProperty("ADBE Ramp");
        ramp.property(1).setValue([960, 0]); ramp.property(2).setValue(hex("#F5F6F9"));
        ramp.property(3).setValue([960, 1080]); ramp.property(4).setValue(hex("#E2E5EC"));

        var y = 250, prev = null;
        for (var i = 0; i < conv.length; i++) {
            var m = conv[i];
            var c = (m.who === "A" ? baseA : baseB).duplicate();
            c.name = "MSG_" + (i + 1) + "_" + m.who; c.parentFolder = folder;
            setText(c, m.text);
            var Cn = c.layer("CONTROLS");
            if (m.grouped) Cn.effect("Zipfel")(1).setValue(0);
            if (m.typing) { Cn.effect("Tippen")(1).setValue(1); Cn.effect("Tippdauer")(1).setValue(m.typing); }
            var gap = (prev === null) ? 0 : (prev === m.who && conv[i - 1].grouped ? 6 : 22);
            var h = bubbleH(c);
            y = y + gap + h;
            Cn.effect("Position")(1).setValue([m.who === "A" ? 1517 : 403, y]);
            var L = pv.layers.add(c); L.startTime = m.t;
            prev = m.who;
        }
        return pv;
    }

    function findComp(name) {
        for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === name) return it; }
        return null;
    }

    // ---------------- Ablauf ----------------
    app.beginSuppressDialogs();
    try {
        log("== build start " + new Date().toString() + " root=" + ROOT_DIR);
        if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        app.newProject();
        app.project.bitsPerChannel = 16;
        var fT = app.project.items.addFolder("TEMPLATES");
        var fP = app.project.items.addFolder("PREVIEW (nicht exportiert)");
        var A = buildBubble("A"); A.parentFolder = fT;
        var Bc = buildBubble("B"); Bc.parentFolder = fT;
        log("bubbles built. A text H=" + bubbleH(A));

        new Folder(ROOT_DIR + "/AE_Source").create();
        new Folder(ROOT_DIR + "/MOGRT").create();
        new Folder(ROOT_DIR + "/Preview").create();

        var pv = buildPreview(A, Bc, fP);
        app.project.save(new File(ROOT_DIR + "/AE_Source/Chat_Bubble_Template.aep"));
        log("saved aep");

        // Zielordner angeben; Dateiname = motionGraphicsTemplateName. Comps nach jedem Export neu holen.
        var okA = findComp(SIDES.A.name).exportAsMotionGraphicsTemplate(true, ROOT_DIR + "/MOGRT");
        var okB = findComp(SIDES.B.name).exportAsMotionGraphicsTemplate(true, ROOT_DIR + "/MOGRT");
        pv = findComp("PREVIEW_CHAT");
        log("mogrt export A=" + okA + " B=" + okB);

        if (DO_RENDER) {
            var rq = app.project.renderQueue;
            while (rq.numItems > 0) rq.item(1).remove();
            var it = rq.items.add(pv);
            var om = it.outputModule(1);
            var tpl = om.templates, pick = null;
            for (var t = 0; t < tpl.length; t++) if (/H\.264/i.test(tpl[t]) && !/Alpha/i.test(tpl[t])) { pick = tpl[t]; break; }
            log("om templates: " + tpl.join(" | "));
            if (pick) { om.applyTemplate(pick); om.file = new File(ROOT_DIR + "/Preview/prototyp_chat.mp4"); }
            else { om.file = new File(ROOT_DIR + "/Preview/prototyp_chat.mov"); }
            log("render with template=" + pick);
            rq.render();
            log("render done");
            app.project.save();
        }
    } catch (e) {
        log("ERR " + e.toString() + " line " + e.line);
    }
    app.endSuppressDialogs(false);
    log("== build end");
})();
