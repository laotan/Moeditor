/*
 *  This file is part of Moeditor.
 *
 *  Copyright (c) 2016 Menci <huanghaorui301@gmail.com>
 *
 *  Moeditor is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Moeditor is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Moeditor. If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var updatePreview = false, updatePreviewRunning = false;
const MoeditorHighlight = require('./moe-highlight');
const MoeditorMathRenderer = require('./moe-math');
const MoeditorUMLRenderer = require('./moe-uml');
const MoeMark = require('moemark');
const SVGFixer = require('./svgfixer');
const path = require('path');
const url = require('url');

MoeMark.setOptions({
    math: true,
    lineNumber: true,
    breaks: false,
    highlight: MoeditorHighlight,
    umlchart: true,
    umlRenderer: MoeditorUMLRenderer
});

module.exports = (cm, force, cb) => {
    function updateAsync() {
        updatePreview = false;
        updatePreviewRunning = true;

        const content = cm.getValue();
        if (w.content === content && !force) {
            updatePreviewRunning = false;
            if (updatePreview) setTimeout(updateAsync, 0);
            cb();
            return;
        }

        if (w.content !== content) {
            w.content = content;
            w.changed = true;
            w.window.setDocumentEdited(true);
        }

        if (window.editMode && !window.editMode.startsWith('preview') && !window.editMode.startsWith('read')) {
            updatePreviewRunning = false;
            if (updatePreview) setTimeout(updateAsync, 0);
            cb();
            return;
        }

        MoeMark.setOptions({
            math: moeApp.config.get('math'),
            umlchart: moeApp.config.get('uml-diagrams'),
            breaks: moeApp.config.get('breaks')
        });

        var mathCnt = 0, mathID = 0, math = new Array();
        var rendering = true, rendered = null;
        const idb = require('idb-keyval');

        MoeMark(content, {
            mathRenderer: (str, display) => {
                var res = MoeditorMathRenderer.tryRender(str, display);
                if (res !== undefined) {
                    return res;
                } else {
                    mathCnt++, mathID++;
                    var id = 'math-' + mathID;
                    var res = '<span id="' + id + '"></span>'
                    math[id] = { s: str, display: display };
                    return res;
                }
            }
        }, (err, val) => {
            rendered = document.createElement('span');
            rendered.innerHTML = val;
            MoeditorMathRenderer.renderMany(math, (math) => {
                for (let id in math) rendered.querySelector('#' + id).innerHTML = math[id].res;

                let imgs = rendered.querySelectorAll('img') || [];
                let imgResolves = Array.from(imgs).map(function (img) {
                        let src = img.getAttribute('src');
                        if (url.parse(src).protocol === null) {
                            if (!path.isAbsolute(src)){
                                let dir = w.fileName ? path.dirname(w.fileName) : w.directory;
                                src = path.resolve(dir, src)
                            }
                            src = url.resolve('file://', src);
                            img.setAttribute('src', src);
                            return src;
                        } else if (url.parse(src).protocol === "blob:") {
                            return idb.get(src.replace("blob:", '')).then(function (val) {
                                img.setAttribute('src', val);
                            })
                        }
                });

                Promise.all(imgResolves).then(function () {

                    var set = new Set();
                    let lineNumbers = rendered.querySelectorAll('moemark-linenumber') || [];
                    for (let elem of lineNumbers) {
                        set.add(parseInt(elem.getAttribute('i')));
                    }

                    window.lineNumbers = (Array.from(set)).sort((a, b) => {
                        return a - b;
                    });
                    window.scrollMap = undefined;

                    document.getElementById('container').innerHTML = rendered.innerHTML;
                    SVGFixer(document.getElementById('container'));

                    if (!window.xyz) window.xyz = rendered.innerHTML;

                    cb();

                    updatePreviewRunning = false;
                    if (updatePreview) setTimeout(updateAsync, 0);
                })

            });
        });
    }

    updatePreview = true;

    if (!updatePreviewRunning) {
        setTimeout(updateAsync, 0);
    }
}
