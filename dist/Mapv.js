!function(){
    var Mapv;

;var util = {
    isPlainObject: function (obj) {
        var key;
        var class2type = {};
        var hasOwn = class2type.hasOwnProperty;

        // Must be an Object.
        // Because of IE, we also have to check the presence of the constructor property.
        // Make sure that DOM nodes and window objects don't pass through, as well
        if (!obj || typeof obj !== 'object' || obj.nodeType) {
            return false;
        }

        // Not own constructor property must be Object
        var hasNoOwn = !hasOwn.call(obj, 'constructor');
        var hasNoOwnPrototypeOf = !hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
        if (obj.constructor && hasNoOwn && hasNoOwnPrototypeOf) {
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.
        for (key in obj) {}

        return key === undefined || hasOwn.call(obj, key);
    },
    /**
     * 深度扩展一个对象
     */
    extend: function (destination, source) {
        var i,
            toStr = Object.prototype.toString,
            astr = '[object Array]';
        destination = destination || {};
        for (i in source) {
            if (source.hasOwnProperty(i)) {
                if (util.isPlainObject(source[i])) {
                    destination[i] = (toStr.call(source[i]) === astr) ? [] : {};
                    arguments.callee(destination[i], source[i]);
                    destination[i] = source[i];
                } else {
                    destination[i] = source[i];
                }
            }
        }
        return destination;
    },

    /**
     * copy an object
     * @param {Object} obj the obj
     * @return {Object} new object
     */
    copy: function (obj) {
        return this.extend({}, obj);
    },
    /**
     * 为类型构造器建立继承关系
     * @name baidu.lang.inherits
     * @function
     * @grammar baidu.lang.inherits(subClass, superClass[, className])
     * @param {Function} subClass 子类构造器
     * @param {Function} superClass 父类构造器
     * @remark
     *
    使subClass继承superClass的prototype，因此subClass的实例能够使用superClass的prototype中定义的所有属性和方法。<br>
    这个函数实际上是建立了subClass和superClass的原型链集成，并对subClass进行了constructor修正。<br>
    <strong>注意：如果要继承构造函数，需要在subClass里面call一下，具体见下面的demo例子</strong>
     * @shortcut inherits
     * @meta standard
     * @see baidu.lang.Class
     */
    inherits: function (subClass, superClass) {
        var key;
        var proto;
        var selfProps = subClass.prototype;
        var Clazz = new Function();
        Clazz.prototype = superClass.prototype;
        proto = subClass.prototype = new Clazz();
        for (key in selfProps) {
            proto[key] = selfProps[key];
        }
        subClass.prototype.constructor = subClass;
        subClass.superClass = superClass.prototype;
    },

    // 在页面中添加样式
    addCssByStyle: function (cssString) {
        var doc = document;
        var style = doc.createElement('style');
        style.setAttribute('type', 'text/css');
        if (style.styleSheet) { // IE
            style.styleSheet.cssText = cssString;
        } else { // w3c
            var cssText = doc.createTextNode(cssString);
            style.appendChild(cssText);
        }

        var heads = doc.getElementsByTagName('head');
        if (heads.length) {
            heads[0].appendChild(style);
        } else {
            doc.documentElement.appendChild(style);
        }
    }
}
;var MVCObject;
(function() {

    function Accessor(target, targetKey) {
        var self = this;
        self.target = target;
        self.targetKey = targetKey;
    }
    Accessor.prototype.transform = function(from, to) {
        var self = this;
        self.from = from;
        self.to = to;
        self.target.notify(self.targetKey);
        return self;
    }

    MVCObject = (function() {

        var getterNameCache = {};
        var setterNameCache = {};
        var uuid = 0;
        var bindings = '__bindings__';
        var accessors = '__accessors__';
        var uid = '__uid__';

        function capitalize(str) {
            return str.substr(0, 1).toUpperCase() + str.substr(1);
        }

        function getUid(obj) {
            return obj[uid] || (obj[uid] = ++uuid);
        }

        function toKey(key) {
            return '_' + key;
        }

        function getGetterName(key) {
            if (getterNameCache.hasOwnProperty(key)) {
                return getterNameCache[key];
            } else {
                return getterNameCache[key] = 'get' + capitalize(key);
            }
        }

        function getSetterName(key) {
            if (setterNameCache.hasOwnProperty(key)) {
                return setterNameCache[key];
            } else {
                return setterNameCache[key] = 'set' + capitalize(key);
            }
        }

        /**
         * @description 这个函数的触发需要时机
         * 在一个key所在的终端对象遍历到时触发
         * 同时传播给所有直接、间接监听targetKey的对象
         * 在调用MVCObject的set方法时开始遍历
         *
         * @param target {MVCObject} 继承了MVCObject的对象
         * @param targetKey {String} 当前对象中被监听的字段
         * @return {void}
         */
        function triggerChange(target, targetKey) {
            var evt = targetKey + '_changed';

            /**
             * 优先检测并执行目标对象key对应的响应方法
             * 其次检测并执行默认方法
             */
            if (target[evt]) {
                target[evt]();
            } else if (typeof target.changed === 'function') {
                target.changed(targetKey);
            }

            if (target[bindings] && target[bindings][targetKey]) {
                var ref = target[bindings][targetKey];
                var bindingObj, bindingUid;
                for (bindingUid in ref) {
                    if (ref.hasOwnProperty(bindingUid)) {
                        bindingObj = ref[bindingUid];
                        triggerChange(bindingObj.target, bindingObj.targetKey);
                    }
                }
            }
        }

        function MVCObject() {};
        var proto = MVCObject.prototype;

        /**
         * @description 从依赖链中获取对应key的值
         * @param {String} key 关键值
         * @return {mixed} 对应的值
         */
        proto.get = function(key) {
            var self = this;
            if (self[accessors] && self[accessors].hasOwnProperty(key)) {
                var accessor = self[accessors][key];
                var targetKey = accessor.targetKey;
                var target = accessor.target;
                var getterName = getGetterName(targetKey);
                var value;
                if (target[getterName]) {
                    value = target[getterName]();
                } else {
                    value = target.get(targetKey);
                }
                if (accessor.to) {
                    value = accessor.to(value);
                }
            } else if (self.hasOwnProperty(toKey(key))) {
                value = self[toKey(key)];
            }
            return value;
        };

        /**
         * @description set方法遍历依赖链直到找到key的持有对象设置key的值;
         * 有三个分支
         * @param {String} key 关键值
         * @param {all} value 要给key设定的值,可以是所有类型
         * @return {this}
         */
        proto.set = function(key, value) {
            var self = this;
            if (self[accessors] && self[accessors].hasOwnProperty(key)) {
                var accessor = self[accessors][key];
                var targetKey = accessor.targetKey;
                var target = accessor.target;
                var setterName = getSetterName(targetKey);
                if (accessor.from) {
                    value = accessor.from(value);
                }
                if (target[setterName]) {
                    target[setterName](value);
                } else {
                    target.set(targetKey, value);
                }
            } else {
                this[toKey(key)] = value;
                triggerChange(self, key);
            }
            return self;
        };

        /**
         * @description 没个MVCObject对象各自的响应对应的key值变化时的逻辑
         */
        proto.changed = function() {};

        /**
         * @description 手动触发对应key的事件传播
         * @param {String} key 关键值
         * @return {this}
         */
        proto.notify = function(key) {
            var self = this;
            if (self[accessors] && self[accessors].hasOwnProperty(key)) {
                var accessor = self[accessors][key];
                var targetKey = accessor.targetKey;
                var target = accessor.target;
                target.notify(targetKey);
            } else {
                triggerChange(self, key);
            }
            return self;
        };

        proto.setValues = function(values) {
            var self = this;
            var key, setterName, value;
            for (key in values) {
                if (values.hasOwnProperty(key)) {
                    value = values[key];
                    setterName = getSetterName(key);
                    if (self[setterName]) {
                        self[setterName](value);
                    } else {
                        self.set(key, value);
                    }
                }
            }
            return self;
        };

        /**
         * @description 将当前对象的一个key与目标对象的targetKey建立监听和广播关系
         * @param key {String} 当前对象上的key
         * @param target {Object} 目标对象
         * @param tarrgetKey {String} 目标对象上的key
         * @param noNotify {Boolean}
         * @return {Accessor}
         */
        proto.bindTo = function(key, target, targetKey, noNotify) {
            targetKey || (targetKey = key);

            var self = this;
            self.unbind(key);

            self[accessors] || (self[accessors] = {});
            target[bindings] || (target[bindings] = {});
            target[bindings][targetKey] || (target[bindings][targetKey] = {});

            var binding = new Accessor(self, key);
            var accessor = new Accessor(target, targetKey);

            self[accessors][key] = accessor;
            target[bindings][targetKey][getUid(self)] = binding;

            if (!noNotify) {
                triggerChange(self, key);
            }

            return accessor;
        };

        /**
         * @description 解除当前对象上key与目标对象的监听
         * @param {String} key 关键字
         * @return {this}
         */
        proto.unbind = function(key) {
            var self = this;
            if (self[accessors]) {
                var accessor = self[accessors][key];
                if (accessor) {
                    var target = accessor.target;
                    var targetKey = accessor.targetKey;
                    self[toKey(key)] = self.get(key);
                    delete target[bindings][targetKey][getUid(self)];
                    delete self[accessors][key];
                }
            }
            return self;
        }

        proto.unbindAll = function() {
            var self = this;
            if (self[accessors]) {
                var ref = self[accessors];
                for (var key in ref) {
                    if (ref.hasOwnProperty(key)) {
                        self.unbind(key);
                    }
                }
            }
            return self;
        };

        return MVCObject;

    })();
})();
;function Class () {
    this.__listeners = {}; // 存储自定义事件对象
}

util.inherits(Class, MVCObject);

/**
 * 注册对象的事件监听器
 * @grammar obj.addEventListener(type, handler[, key])
 * @param 	{string}   type         自定义事件的名称
 * @param 	{Function} handler      自定义事件被触发时应该调用的回调函数
 * @remark 	事件类型区分大小写。如果自定义事件名称不是以小写"on"开头，该方法会给它加上"on"再进行判断，即"click"和"onclick"会被认为是同一种事件。 
 */
Class.prototype.addEventListener = function (type, handler) {
    typeof this.__listeners[type] != "object" && (this.__listeners[type] = []);
    this.__listeners[type].push(handler);

    return this;
}


/**
 * 移除对象的事件监听器。
 * @grammar obj.removeEventListener(type, handler)
 * @param {string}   type     事件类型
 * @param {Function} handler  要移除的事件监听函数
 * @remark 	如果第二个参数handler没有被绑定到对应的自定义事件中，什么也不做。
 */
Class.prototype.removeEventListener = function (type, handler) {
    var fns = this.__listeners[type];

    if (!fns) {
        return false;
    }

    for (var i = fns.length; i >= 0; i--) {
        if (fns[i] === handler) {
            fns.splice(i, 1);
        }
    }

    return this;
};

/**
 * 派发自定义事件，使得绑定到自定义事件上面的函数都会被执行
 * @grammar obj.dispatchEvent(event, options)
 * @param {String} 事件名称
 * @param {Object} options 扩展参数
 */
Class.prototype.dispatchEvent = function (type, options) {
    var event = util.extend({}, options);

    var fns = this.__listeners[type];

    if (!fns) {
        return false;
    }

    for (var i = fns.length - 1; i >= 0; i--) {
        fns[i].call(this, event);
    }

    return this;
    
}

Class.prototype.dispose = function () {
}

;/* globals Layer GeoData DrawTypeControl OptionalData util DataControl DrawScale DataRangeControl*/

/**
 * @param {Object}
 */
function Mapv(options) {

    Class.call(this);

    this._layers = [];

    this._initOptions(options);
    this._initDrawScale();
    this._initDataRange();
    this._initGeodata();

    // this._initDrawer();
    this._initDrawTypeControl();
    this._initOptionDataControl();
    this.setOptions(options);

    // for data control
    // console.log('???', this.geoData);
    new DataControl(this);
}

util.inherits(Mapv, Class);

Mapv.prototype._initDrawScale = function () {
    this.Scale = new DrawScale();
};

Mapv.prototype._initOptionDataControl = function () {
    this.OptionalData = new OptionalData(this);
};

/**
 * reset the options
 * @param {Object} options the option
 * @param {Object} wipe    if you want wipe some data user this
 *                         if the value is true , the data of the key will wiped
 *                         forexample {drawOptions:true,map:false}
 *                             will wipe the drawOtions,while the map is false , it'll keeped
 */
Mapv.prototype.setOptions = function (options, wipe) {
    util.extend(this.options, options);
    return;

    if (options.data !== undefined) {
        this.geoData.setData(options.data);
    }
    this.layer.draw();

    if (drawer.scale) {
        drawer.scale(this.Scale);
        this.Scale.show();
    } else {
        this.Scale.hide();
    }

    // drawer.drawMap(this, this.ctx, this.options.data);
};



/**
 * @param {}
 * 初始化参数
 */
Mapv.prototype._initOptions = function (options) {
    var defaultOptions = {
        drawType: 'simple'
    };

    options = options || {};

    this.options = util.extend(defaultOptions, options);
};

Mapv.prototype._initGeodata = function () {
    this.geoData = new GeoData(this);
};

Mapv.prototype._initDataRange = function () {
    this._dataRangeCtrol = new DataRangeControl();
    this.options.map.addControl(this._dataRangeCtrol);
}

Mapv.prototype._initDrawer = function () {
    this._drawer = {};
}

Mapv.prototype._initDrawTypeControl = function () {
    this._drawTypeControl = new DrawTypeControl({
        mapv: this
    });
    this.options.map.addControl(this._drawTypeControl);
};

Mapv.prototype.getMap = function () {
    return this.options.map;
};

Mapv.prototype.getDataRangeCtrol = function () {
    return this._dataRangeCtrol;
};

Mapv.prototype.getOptions = function () {
    return this.options;
};
;function Layer (options) {

    Class.call(this);

    this.ctx = null;
    this._drawer = {};

    this.options = {
        drawType: 'simple',
        data: []
    };

    util.extend(this.options, options);
    this.setData(this.options.data);
}

util.inherits(Layer, Class);

util.extend(Layer.prototype, {
    initialize: function () {
        if (this.mapMask) {
            return;
        }

        this.mapMask = new MapMask({
            map: this._mapv.getMap(),
            zIndex: this.options.zIndex,
            elementTag: "canvas"
        });

        this.ctx = this.mapMask.getContainer().getContext("2d");

        var that = this;
        this.mapMask.addEventListener('draw', function () {
            that.draw();
        });
    },

    draw: function () {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.canvas.width = ctx.canvas.width;
        ctx.canvas.height = ctx.canvas.height;
        this._calculatePixel();

        this._getDrawer().drawMap(this._mapv, ctx);
    },

    _layerAdd: function (mapv) {
        this._mapv = mapv;
        var map = this._mapv.getMap();
        this.initialize();
        this.updateControl();

        this.draw();
    },

    getData: function () {
        return this.options.data;
    },

    setDrawType: function (drawType) {
        this.options.drawType = drawType;
        this.updateControl();
        this.draw();
    },

    updateControl: function () {
        var mapv = this._mapv;
        var drawer = this._getDrawer();
        if (drawer.drawDataRange) {
            map.addControl(mapv._dataRangeCtrol);
            drawer.drawDataRange(mapv._dataRangeCtrol.getContainer());
        } else {
            map.removeControl(mapv._dataRangeCtrol);
        }
        mapv._drawTypeControl.showLayer(this);
        this._mapv.OptionalData && this._mapv.OptionalData.initController(this, this.options.drawType);
    },

    _getDrawer: function () {
        var drawType = this.options.drawType;

        if (!this._drawer[drawType]) {
            var funcName = drawType.replace(/(\w)/, function (v) {
                return v.toUpperCase();
            });
            funcName += 'Drawer';
            var drawer = this._drawer[drawType] = eval('(new ' + funcName + '(this))');
            drawer.setDrawOptions(this.options.drawOptions[drawType]);
            if (drawer.scale) {
                drawer.scale(this._mapv.Scale);
                this._mapv.Scale.show();
            } else {
                this._mapv.Scale.hide();
            }
        }
        return this._drawer[drawType];
    },

    _calculatePixel: function () {
        var map = this._mapv.getMap();
        var mercatorProjection = map.getMapType().getProjection();
        // 墨卡托坐标计算方法
        var zoom = map.getZoom();
        var zoomUnit = Math.pow(2, 18 - zoom);
        var mcCenter = mercatorProjection.lngLatToPoint(map.getCenter());
        var nwMc = new BMap.Pixel(mcCenter.x - (map.getSize().width / 2) * zoomUnit,
            mcCenter.y + (map.getSize().height / 2) * zoomUnit); //左上角墨卡托坐标

        var data = this.options.data;

        for (var j = 0; j < data.length; j++) {

            if (data[j].lng && data[j].lat) {
                var pixel = this._mapv.getMap().pointToPixel(new BMap.Point(data[j].lng, data[j].lat));
                data[j].px = pixel.x;
                data[j].py = pixel.y;
            }

            if (data[j].x && data[j].y) {

                data[j].px = (data[j].x - nwMc.x) / zoomUnit;
                data[j].py = (nwMc.y - data[j].y) / zoomUnit;

            }
        }
    },

    setData: function (data) {
        // console.log('GGGG',data)
        if (!data) {
            this.data = [];
            return;
        }

        this._min = data[0].count;
        this._max = data[0].count;
        for (var i = 0; i < data.length; i++) {
            this._max = Math.max(this._max, data[i].count);
            this._min = Math.min(this._min, data[i].count);
        }
        this.options.data = data;
    },

    getDataRange: function () {
        return {
            min: this._min,
            max: this._max
        };
    }
});

util.extend(Mapv.prototype, {

    addLayer: function (layer) {
        this._layers.push(layer);
        layer._layerAdd(this);
    },

    removeLayer: function (layer) {
        for (var i = this._layers.length--; i >= 0; i--) {
            if (this._layers[i] === layer) {
                this._layers.splice(i, 1);
            }
        }
    }
});

;function MapMask(options){
    this.options = options || {};
    this.initElement();
    this._map = options.map;
    this.show();
}

MapMask.prototype = new BMap.Overlay();
MapMask.prototype.initialize = function(map){
    this._map = map;
    var elementTag = this.options.elementTag || "div";
    var element = this.element = document.createElement(elementTag);
    var size = map.getSize();
    element.width = size.width;
    element.height = size.height;
    element.style.cssText = "position:absolute;"
                            + "left:0;" 
                            + "top:0;"
                            + "width:" + size.width + "px;"
                            + "height:" + size.height + "px";

    if (this.options.zIndex !== undefined) {
        element.style.zIndex = this.options.zIndex;
    }

    map.getPanes().labelPane.appendChild(this.element);
    return this.element;
}

MapMask.prototype.initElement = function(map){
}

MapMask.prototype.draw = function(){
    var map = this._map;
    var bounds = map.getBounds();
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    var pixel = map.pointToOverlayPixel(new BMap.Point(sw.lng, ne.lat));
    this.element.style.left = pixel.x + "px";
    this.element.style.top = pixel.y + "px";
    this.dispatchEvent('draw');
}

MapMask.prototype.getContainer = function(){
    return this.element;
}

MapMask.prototype.show = function(){
    this._map.addOverlay(this);
}

MapMask.prototype.hide = function(){
    this._map.removeOverlay(this);
}

;/* globals BMap map mercatorProjection*/

function GeoData(superObj) {
    var map = superObj.options.map;
    var data = superObj.options.data;
    this.super = superObj;
    this.setData(data);
    this.map = map;
}

/**
 * 重新计算相对于当前屏幕左上角的像素坐标
 */
GeoData.prototype.calculatePixel = function () {

    // 墨卡托坐标计算方法
    var zoom = map.getZoom();
    var zoomUnit = Math.pow(2, 18 - zoom);
    var mcCenter = mercatorProjection.lngLatToPoint(map.getCenter());
    var nwMc = new BMap.Pixel(mcCenter.x - (map.getSize().width / 2) * zoomUnit,
        mcCenter.y + (map.getSize().height / 2) * zoomUnit); //左上角墨卡托坐标

    var data = this.data;

    // data = [{
    //     count: 100,
    //     x: 12958157.19,
    //     y: 4825935.04
    // }]

    for (var j = 0; j < data.length; j++) {

        if (data[j].lng && data[j].lat) {
            var pixel = this.map.pointToPixel(new BMap.Point(data[j].lng, data[j].lat));
            data[j].px = pixel.x;
            data[j].py = pixel.y;
        }

        if (data[j].x && data[j].y) {

            data[j].px = (data[j].x - nwMc.x) / zoomUnit;
            data[j].py = (nwMc.y - data[j].y) / zoomUnit;

        }

        // console.log(data[j])

        // if (j >= 5) {
        // break;
        // }
    }
};


GeoData.prototype.getData = function () {
    return this.data;
};

GeoData.prototype.setData = function (data) {
    // console.log('GGGG',data)
    if (!data) {
        this.data = [];
        return;
    }

    this._min = data[0].count;
    this._max = data[0].count;
    for (var i = 0; i < data.length; i++) {
        this._max = Math.max(this._max, data[i].count);
        this._min = Math.min(this._min, data[i].count);
    }
    this.data = data;
};

GeoData.prototype.getDataRange = function () {
    return {
        min: this._min,
        max: this._max
    };
};
;function DataControl(superObj) {
    this.initDom();
    this.initEvent();
    this.initHistory();
    this.super = superObj;
    this.geoData = superObj.geoData;
    // console.log(this.geoData.setData);
}

DataControl.prototype.initHistory = function () {
    var historyFiles = localStorage.getItem('filenames');
    historyFiles = JSON.parse(historyFiles);
    this.history.innerHTML = '';
    // window.console.log('history', historyFiles);

    var unit = ['bit', 'KB', 'MB', 'GB'];

    for (var i in historyFiles) {
        var saveName = i;
        var fileName = historyFiles[i].name;
        var fileSize = historyFiles[i].size;
        var a = document.createElement('a');
        a.setAttribute('storageName', i);

        var index = 0;
        while (fileSize > 1024) {
            fileSize = parseInt(fileSize / 1024, 10);
            index++;
        }
        a.href = '#';
        a.style.color = 'orange';
        a.style.marginRight = '10px';
        a.textContent = fileName + '(' + fileSize + unit[index] + ')  ';
        this.history.appendChild(a);
    }
};

DataControl.prototype.initDom = function () {
    var control = this.control = document.createElement('div');

    var input = this.input = document.createElement('input');
    input.type = 'file';
    var tipstitle = document.createElement('div');
    tipstitle.textContent = '自定义数据：';
    var tips = document.createElement('div');
    tips.textContent = '拖拽文件到窗口或者选择自定义文件';



    control.appendChild(tipstitle);
    control.appendChild(tips);
    control.appendChild(input);
    control.style.fontSize = '12px';
    control.style.lineHeight = '1.8em';
    control.style.position = 'absolute';
    control.style.bottom = '50px';
    control.style.left = '10px';
    control.style.padding = '10px 20px';
    control.style.color = '#FFF';
    control.style.background = 'rgba(0,0,0,0.5)';
    control.style.zIndex = '100000';
    control.style.overflow = 'hidden';
    control.style.webkitTransition = 'all 0.5s ease-in';

    var history = document.createElement('div');
    var historyTitle = document.createElement('div');
    historyTitle.textContent = '历史数据';
    this.history = document.createElement('div');
    history.appendChild(historyTitle);
    history.appendChild(this.history);
    control.appendChild(history);

    document.body.appendChild(control);
};

DataControl.prototype.initEvent = function () {
    var self = this;
    var reader = new FileReader();
    reader.addEventListener('load', function (e) {

        var text = reader.result;
        var draw = formatRender(text);

        if (draw) {
            var filenames = localStorage.getItem('filenames') || '{}';
            filenames = JSON.parse(filenames);
            if (!reader.fileName || !reader.fileSize) {
                console.log('no fileName or fileSize , save faild ');
                return false;
            }
            for (var i in filenames) {
                if (filenames[i].name === this.fileName && filenames[i].size === this.fileSize) {
                    return false;
                }
            }
            var saveName = this.fileName + this.fileSize + parseInt(Math.random() * 1e17, 10).toString(36);
            filenames[saveName] = {
                size: this.fileSize,
                name: this.fileName
            };
            // console.log(filenames)
            localStorage.setItem('filenames', JSON.stringify(filenames));
            localStorage.setItem(saveName, JSON.stringify(text));
            self.initHistory();
        }
    });

    self.history.addEventListener('click', function (e) {
        var node = e.target;
        if (node.nodeName === 'A') {
            var storageName = node.getAttribute('storageName');
            var dataStr = localStorage.getItem(storageName);
            // console.log(dataStr);
            formatRender(dataStr);
            // reader.readAsText(dataStr);
            // reader.fileName = null;
            // reader.fileSize = null;
        }
        return false;
    });

    self.input.addEventListener('change', function (e) {
        reader.readAsText(e.target.files[0]);
        reader.fileName = e.target.files[0].name;
        reader.fileSize = e.target.files[0].size;
    });

    document.addEventListener('dragover', function (event) {
        event.preventDefault();
    }, false);
    document.addEventListener('drop', function (event) {
        event.preventDefault();
        reader.readAsText(event.dataTransfer.files[0]);
        reader.fileName = event.dataTransfer.files[0].name;
        reader.fileSize = event.dataTransfer.files[0].size;
        return false;
    });

    function formatRender(dataStr) {

        var data;
        var wrongType = false;

        try {
            data = JSON.parse(dataStr.replace(/\s/g, ''));
            // console.log('??!@',data)
            var count = 0;
            while (typeof (data) === 'string' && count <= 10) {
                data = JSON.parse(data);
                count++;
            }
            wrongType = false;
        } catch (e) {
            wrongType = true;
        }

        if (wrongType) {
            try {
                data = [];
                var dataT = dataStr.split('\n');
                if (dataT.length <= 1) {
                    dataT = dataStr.split('\\n');
                }

                var keys = dataT[0].split(',');
                // console.log(keys)
                for (var i = 1; i < keys.length; i++) {
                    var values = dataT[i].split(',');
                    var obj = {};
                    var nonameIndex = 0;
                    for (var j = 0; j < values.length; j++) {
                        var name = keys[j] || 'noname' + (nonameIndex++);
                        name = name.replace(/\\r/g, '');
                        obj[name] = Number(values[j].replace(/\\r/g, '').replace(/\"/g, ''));
                    }
                    data.push(obj);
                }

                data = JSON.stringify(data).replace(/\\r/g, '');

                data = JSON.parse(data);

                wrongType = false;
            } catch (e) {
                window.console.log(e);
                wrongType = true;
            }
        }

        if (wrongType) {
            alert('数据格式错误，请检查是否为json或者csv格式数据');
            return false;
        }

        self.geoData.setData(data);
        self.super.layer.draw();

        // var drawer = this.super._getDrawer(this.super.options.drawType);
        // drawer.drawDataRange(this.super._dataRangeCtrol.getContainer(), this.super.options.data);
        return true;
    }

};
;function DataRangeControl(){
    // 默认停靠位置和偏移量
    this.defaultAnchor = BMAP_ANCHOR_BOTTOM_RIGHT;
    this.defaultOffset = new BMap.Size(10, 10);
}

DataRangeControl.prototype = new BMap.Control();

DataRangeControl.prototype.initialize = function(map){
    var canvas = this.canvas = document.createElement("canvas");
    canvas.style.background = "#fff";
    canvas.style.boxShadow = "rgba(0,0,0,0.2) 0 0 4px 2px";
    canvas.style.border = "1px solid #999999";
    canvas.style.borderRadius = "4px";
    // 添加DOM元素到地图中
    map.getContainer().appendChild(canvas);
    // 将DOM元素返回
    return canvas;
}

DataRangeControl.prototype.getContainer = function(map){
    return this.canvas;
}
;function DrawScale() {
    this.init();
    this._Event();
}


DrawScale.prototype.change = function (callback) {
    var self = this;
    self.changeFn = callback;
};

DrawScale.prototype.hide = function () {
    var self = this;
    self.box.style.display = 'none';
};

DrawScale.prototype.show = function () {
    var self = this;
    self.box.style.display = 'block';
};

DrawScale.prototype.set = function (obj) {
    var self = this;
    self.max = obj.max || self.max;
    self.min = obj.min || self.min;
    self.colors = obj.colors || self.colors;

    self._draw();
};

/**
 * init dom
 */
DrawScale.prototype.init = function () {
    var self = this;

    // prepare param
    // param-num
    self.changeFn = null;
    self.width = 55;
    self.height = 250;
    self.min = 0;
    self.max = 100;
    self.offsetTop = 10;
    self.offsetBottom = 10;
    self.drawHeight = self.height - self.offsetTop - self.offsetBottom;
    self.colors = [
        '#49ae22', '#77c01a', '#a0cd12', '#cadd0a', '#f8ed01', '#e1de03', '#feb60a', '#fe7e13', '#fe571b', '#fd3620'
    ];
    self.defaultColors = [
        '#49ae22', '#77c01a', '#a0cd12', '#cadd0a', '#f8ed01', '#e1de03', '#feb60a', '#fe7e13', '#fe571b', '#fd3620'
    ];
    // param-event
    self.point = {
        x: 0,
        y: 0
    };
    self.hoveredHandle = null;
    self.showHandle = false;
    self.handleStartPos = {
        // x: 0,
        val: self.min,
        yMin: self.offsetTop,
        yMax: self.offsetTop + self.drawHeight,
        y: self.offsetTop
    };
    self.handleEndPos = {
        // x: 0,
        val: self.max,
        yMin: self.offsetTop,
        yMax: self.offsetTop + self.drawHeight,
        y: self.offsetTop + self.drawHeight
    };

    // prepare dom
    var box = self.box = document.createElement('div');
    var canvas = document.createElement('canvas');
    canvas.width = self.width;
    canvas.height = self.height;
    canvas.style.cursor = 'pointer';
    box.style.border = '1px solid #999';
    box.style.boxShadow = 'rgba(0, 0, 0, 0.2) 0px 0px 4px 2px';
    box.style.borderRadius = '6px';
    box.style.background = 'white';
    box.style.position = 'absolute';
    box.style.right = '10px';
    box.style.bottom = '10px';
    box.style.width = self.width + 'px';
    box.style.height = self.height + 'px';
    box.style.zIndex = 10000;
    box.appendChild(canvas);
    document.body.appendChild(box);

    //
    self.ctx = canvas.getContext('2d');

    // draw it
    self._draw();
};

DrawScale.prototype._Event = function () {
    var self = this;
    var canvas = self.ctx.canvas;

    var canDrag = false;
    var mousePos = {
        x: 0,
        y: 0
    };
    var tarPos = {
        // x: 0,
        y: 0,
        name: null
    };

    canvas.addEventListener('mouseenter', function () {
        self.showHandle = true;
        self._draw();
    });

    canvas.addEventListener('mouseleave', function () {
        self.showHandle = false;
        self._draw();
    });

    canvas.addEventListener('mousedown', function (e) {
        var tar = self.hoveredHandle;
        if (tar) {
            mousePos.x = e.pageX;
            mousePos.y = e.pageY;
            var handleName = 'handle' + tar.name + 'Pos';
            tarPos.name = handleName;
            tarPos.y = self[handleName].y;
            canDrag = true;
        }
    });

    window.addEventListener('mousemove', function (e) {
        self.point.x = e.offsetX;
        self.point.y = e.offsetY;
        if (canDrag) {
            var desY = e.pageY - mousePos.y;
            self[tarPos.name].y = tarPos.y + desY;

            // set max and min
            var val = tarPos.y + desY;
            var max = self[tarPos.name].yMax;
            var min = self[tarPos.name].yMin;
            val = val > max ? max : val;
            val = val < min ? min : val;
            self[tarPos.name].y = val;
            // set max and min
            if (tarPos.name === 'handleStartPos') {
                self.handleEndPos.yMin = val;
            }
            if (tarPos.name === 'handleEndPos') {
                self.handleStartPos.yMax = val;
            }
            //
            e.preventDefault();
        }
        self._draw();
    });

    window.addEventListener('mouseup', function (e) {
        if (canDrag) {
            self.changeFn && self.changeFn(self.handleStartPos.val, self.handleEndPos.val);
            canDrag = false;
        }
    });
};

DrawScale.prototype._draw = function () {
    var self = this;
    var ctx = self.ctx;
    // clear
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    self.hoveredHandle = null;

    // draw gradient
    var gradientOffsetLeft = 5;
    var gradientOffsetTop = self.offsetTop;
    var gradientWidth = 10;
    var gradientHeight = self.drawHeight;

    var tempColor;
    if (self.colors === 'default') {
        tempColor = self.defaultColors;
    } else {
        tempColor = self.colors;
    }
    var gradient = ctx.createLinearGradient(gradientOffsetLeft, gradientOffsetTop, gradientWidth, gradientHeight);
    var steps = gradientHeight / (tempColor.length - 1);
    if (self.colors instanceof Array || self.colors === 'default') {
        for (var i = 0; i < tempColor.length; i++) {
            var present = i * steps / self.height;
            gradient.addColorStop(present, tempColor[i]);
        }
    } else if (typeof (self.colors) === 'object') {
        for (var i in self.colors) {
            gradient.addColorStop(i, self.colors[i]);
        }
    }
    ctx.fillStyle = ctx.strokeStyle = gradient;
    ctx.fillRect(gradientOffsetLeft, gradientOffsetTop, gradientWidth, gradientHeight);
    // gradient end

    var startValOrigin = (self.handleStartPos.y - gradientOffsetTop) / gradientHeight * self.max | 0;
    var startVal = self.handleStartPos.val = startValOrigin + self.min;
    var endVal = self.handleEndPos.val = (self.handleEndPos.y - gradientOffsetTop) / gradientHeight * self.max | 0;

    // draw text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    var textLeft = gradientOffsetLeft + gradientWidth + 5;
    ctx.fillText('- ' + self.min, textLeft, gradientOffsetTop);
    ctx.fillText('- ' + self.max, textLeft, gradientOffsetTop + gradientHeight);

    // draw range text
    ctx.save();
    ctx.fillStyle = 'grey';
    if (self.handleStartPos.y > gradientOffsetTop + 10) {
        ctx.fillText('- ' + startVal, textLeft, self.handleStartPos.y);
    }
    if (self.handleEndPos.y < gradientOffsetTop + gradientHeight - 10) {
        ctx.fillText('- ' + endVal, textLeft, self.handleEndPos.y);
    }
    ctx.restore();

    // draw handle
    if (self.showHandle) {
        drawTips({
            sup: self,
            name: 'Start',
            ctx: ctx,
            left: gradientOffsetLeft + gradientWidth,
            right: ctx.canvas.width - 5,
            top: self.handleStartPos.y,
            text: startVal
        });

        drawTips({
            sup: self,
            name: 'End',
            ctx: ctx,
            left: gradientOffsetLeft + gradientWidth,
            right: ctx.canvas.width - 5,
            top: self.handleEndPos.y,
            text: endVal
        });
    }

    // draw grey area
    ctx.save();
    ctx.fillStyle = '#ADABAB';
    var greyLeft = gradientOffsetLeft;
    var greyWidth = gradientWidth;
    ctx.fillRect(greyLeft, gradientOffsetTop, greyWidth, self.handleStartPos.y - self.offsetTop);
    ctx.fillRect(greyLeft, self.handleEndPos.y, greyWidth, gradientHeight - self.handleEndPos.y + self.offsetTop);
    ctx.restore();

    // hover
    if (self.hoveredHandle) {
        ctx.canvas.style.cursor = 'pointer';
    } else {
        ctx.canvas.style.cursor = 'default';
    }

};

function drawTips(obj) {
    // draw handle
    var hdlMid = obj.left;
    var hdlRight = obj.right;
    var hdlTop = obj.top;
    var ctx = obj.ctx;
    ctx.beginPath();
    ctx.moveTo(hdlMid + 8, hdlTop - 7);
    ctx.lineTo(hdlRight, hdlTop - 7);
    ctx.lineTo(hdlRight, hdlTop + 7);
    ctx.lineTo(hdlMid + 8, hdlTop + 7);
    ctx.lineTo(hdlMid, hdlTop);
    ctx.fill();

    // isHover
    var isHover = ctx.isPointInPath(obj.sup.point.x, obj.sup.point.y);
    if (isHover) {
        obj.sup.hoveredHandle = obj;
    }

    // add text
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillText(obj.text, hdlMid + 8, hdlTop);
    ctx.restore();
}
;/* globals util BMap BMAP_ANCHOR_TOP_LEFT BMAP_ANCHOR_TOP_RIGHT*/

util.addCssByStyle(
    [
        '#MapvDrawTypeControl { list-style:none; position:absolute; left:10px; top:10px; padding:0; margin:0; }',
        '#MapvDrawTypeControl li{ padding:0; margin:0; cursor:pointer; margin:1px 0;',
        'color:#fff; padding:5px; background:rgba(0, 0, 0, 0.5); }',
        '#MapvDrawTypeControl li.current{ background:rgba(0, 0, 255, 0.5); }'
    ].join('\n')
);

function DrawTypeControl(options) {
    options = options || {};
    // console.log('@@@@@@', options)
    this.mapv = options.mapv;
    // 默认停靠位置和偏移量
    this.defaultAnchor = BMAP_ANCHOR_TOP_RIGHT;
    this.defaultOffset = new BMap.Size(10, 10);
}

DrawTypeControl.prototype = new BMap.Control();

DrawTypeControl.prototype.initialize = function (map) {
    var ul = this.ul = document.createElement('ul');
    // console.log(this.mapv.options.drawOptions)
    // var drawTypes = {
    //     simple: '普通打点',
    //     bubble: '普通打点',
    //     choropleth: '普通打点',
    //     density: '普通打点',
    //     heatmap: '普通打点',
    //     category: '普通打点',
    //     intensity: '普通打点'
    // };


    ul.setAttribute('id', 'MapvDrawTypeControl');

    var me = this;

    ul.addEventListener('click', function (e) {
        var target = e.target;
        if (target.nodeName === 'LI') {
            var parentNode = target.parentNode;
            var children = parentNode.getElementsByTagName('li');
            for (var i = 0; i < children.length; i++) {
                children[i].className = '';
            }
            var drawType = target.getAttribute('drawType');
            target.className = 'current';
            me._layer.setDrawType(drawType);
        }
    });

    // 添加DOM元素到地图中
    map.getContainer().appendChild(ul);
    // 将DOM元素返回
    return ul;

};

DrawTypeControl.prototype.getContainer = function () {
    return this.ul;
};

DrawTypeControl.prototype.showLayer = function (layer) {
    this._layer = layer;
    // get the drawTypes from options by Mofei
    var ul = this.ul;
    ul.innerHTML = "";
    var drawTypes = layer.options.drawOptions;
    for (var key in drawTypes) {
        var li = document.createElement('li');
        if (layer.options.drawType === key) {
            li.className = 'current';
        }
        li.setAttribute('drawType', key);
        li.innerHTML = key;
        ul.appendChild(li);
    }

}
;/* globals util */

function OptionalData(superObj) {
    // set params
    var options = superObj.options;
    this.drawType = options.drawType;
    this.super = superObj;
    // init options
    this.options = options.drawOptions || {};

    // init css
    this.initCSS();
    // append dom to body
    this.initDom();
    // append controller
    this.initController();
    // bind event
    this.bindEvent();
}

OptionalData.prototype.initCSS = function () {
    util.addCssByStyle([
        '.controlBox { position:absolute; left:10px; top:10px; background:rgba(0,0,0,0.5); padding:10px; }',
        '.controlBox input {border-radius:6px; border:none; padding:10px;}',
        '.controlBox button ',
        '{ padding:8px 10px; border:none; width:40%; margin-left: 10px; border-radius:6px; cursor:pointer; }',
        '.controlBoxBlock { color:#fff; padding: 10px; }',
        '.controlBoxTitle { display:inline-block; width:100px; text-align:right; padding-right:10px; }'
    ].join('\n'));
};

/**
 * append the content to body
 * @return {DOM} return the appneded dom
 */
OptionalData.prototype.initDom = function () {
    var box = this.box = document.createElement('div');
    box.className = 'controlBox';
    var contentBox = this.contentBox = document.createElement('div');
    var btnBox = document.createElement('div');
    btnBox.style.textAlign = 'center';
    var updateBtn = this.updateBtn = document.createElement('button');
    var resetBtn = this.resetBtn = document.createElement('button');
    updateBtn.textContent = 'update';
    resetBtn.textContent = 'reset';
    box.appendChild(contentBox);
    btnBox.appendChild(updateBtn);
    btnBox.appendChild(resetBtn);
    box.appendChild(btnBox);
    document.body.appendChild(box);
    return box;
};

/**
 * init the controller to box
 */
OptionalData.prototype.initController = function (layer, drawType) {
    this._layer = layer;

    var self = this;
    var options;

    if (drawType) {
        var drawer = layer._getDrawer(drawType);
        options = self.options = drawer.getDrawOptions();
        self.drawType = drawType;
    } else {
        options = self.options;
    }

    var editTag = options.editable;

    if (!editTag) {
        self.box.style.display = 'none';
        return false;
    } else {
        self.box.style.display = 'block';
    }

    self.contentBox.innerHTML = '';

    var newTag = [];
    for (var i = 0; i < editTag.length; i++) {
        var tag = editTag[i];
        if (typeof (tag) === 'string') {
            tag = {
                name: tag,
                type: 'value'
            };
            editTag[i] = tag;
        }
        if (options[tag.name]) {
            makeLabelInput(tag);
            editTag[i]._oldVal = options[tag.name];
            newTag.push(editTag[i]);
        }
    }
    options.editable = newTag;

    function makeLabelInput(tag) {
        var box = document.createElement('div');
        box.className = 'controlBoxBlock';

        var span = document.createElement('span');
        span.textContent = tag.name;
        span.className = 'controlBoxTitle';
        // span.style.padding = '0 10px';

        // if type equal value , show normal inoput
        // if type equal option , show checkboxk
        var optionBox;
        if (tag.type === 'value') {
            optionBox = document.createElement('label');
            var input = document.createElement('input');
            input.name = tag.name;
            input.value = options[tag.name];
            optionBox.appendChild(input);
        } else if (tag.type === 'option') {
            optionBox = document.createElement('span');
            for (var i = 0; i < tag.value.length; i++) {
                var label = document.createElement('label');
                label.style.padding = '0 10px 0  0';
                label.style.cursor = 'pointer';
                var radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = tag.name;
                radio.value = tag.value[i];
                if (options[tag.name] === tag.value[i]) {
                    radio.checked = true;
                }
                var labelSpan = document.createElement('span');
                labelSpan.textContent = tag.value[i];
                label.appendChild(radio);
                label.appendChild(labelSpan);
                optionBox.appendChild(label);
            }
        } else if (tag.type === 'check') {
            optionBox = document.createElement('label');
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.name = tag.name;
            input.checked = options[tag.name];
            optionBox.appendChild(input);
        } else if (tag.type === 'json') {
            optionBox = document.createElement('label');
            var input = document.createElement('input');
            input.setAttribute("isJson", true);
            input.name = tag.name;
            input.value = JSON.stringify(options[tag.name]);
            optionBox.appendChild(input);
        } else {
            return false;
        }

        box.appendChild(span);
        box.appendChild(optionBox);
        self.contentBox.appendChild(box);
    }
};

/**
 * bind update and reset button's event
 */
OptionalData.prototype.bindEvent = function () {
    var self = this;
    this.updateBtn.onclick = function () {
        for (var i = 0; i < self.options.editable.length; i++) {
            var name = self.options.editable[i].name;
            var val = self.contentBox.querySelector('input[name="' + name + '"]');
            if (val) {
                if (val.type === 'radio') {
                    val = self.contentBox.querySelector('input[name="' + name + '"]:checked');
                    self.options[name] = val.value;
                } else if (val.type === 'checkbox') {
                    val = self.contentBox.querySelector('input[name="' + name + '"]');
                    self.options[name] = val.checked;
                } else {
                    if (val.getAttribute('isJson') === 'true') {
                        console.log(1);
                        self.options[name] = JSON.parse(val.value);
                    } else {
                        self.options[name] = val.value;
                    }
                }

            }
        }

        var drawer = self._layer._getDrawer(self.drawType);
        drawer.setDrawOptions(self.options);
        self._layer.draw();
    };

    this.resetBtn.onclick = function () {
        for (var i = 0; i < self.options.editable.length; i++) {
            var name = self.options.editable[i].name;
            var oldVal = self.options.editable[i]._oldVal;
            self.options[name] = oldVal;
        }
        var drawer = this._layer._getDrawer(self.drawType);
        drawer.setDrawOptions(self.options);
        this._layer.draw();
        self.initController();
        // console.log('reset', self.options);
    };
};

;/* globals util */

function Drawer(layer) {
    Class.call(this);

    this._layer = layer;
    this.mapv = layer._mapv;
    this.drawOptions = {};
}

util.inherits(Drawer, Class);

Drawer.prototype.defaultDrawOptions = {
    radius: 2
};

Drawer.prototype.drawMap = function () {};

// we need defined drawDataRange so that in Mapv.js
//      we can shwo or remove range cans by drawer.drawDataRange
// Drawer.prototype.drawDataRange = function () {};

Drawer.prototype.setDrawOptions = function (drawOptions) {
    var defaultObj = util.copy(this.defaultDrawOptions);
    this.drawOptions = util.extend(defaultObj, drawOptions);
    if (this.drawOptions.splitList) {
        this.splitList = this.drawOptions.splitList;
    } else {
        this.generalSplitList();
    }

    this.drawDataRange && this.drawDataRange();

    // console.log('set-----',this.drawOptions);
};

Drawer.prototype.getDrawOptions = function () {
    // console.log('get-----',this.drawOptions);
    return this.drawOptions;
};

Drawer.prototype.clearDrawOptions = function (drawOptions) {
    this.drawOptions = {};
};

Drawer.prototype.colors = [
    'rgba(17, 102, 252, 0.8)',
    'rgba(52, 139, 251, 0.8)',
    'rgba(110, 176, 253, 0.8)',
    'rgba(255, 241, 193, 0.8)',
    'rgba(255, 146, 149, 0.8)',
    'rgba(253, 98, 104, 0.8)',
    'rgba(255, 0, 0, 0.8)',
    'rgba(255, 51, 61, 0.8)'
];

Drawer.prototype.generalSplitList = function () {
    var dataRange = this._layer.getDataRange();
    var splitNum = Math.ceil((dataRange.max - dataRange.min) / 7);
    var index = dataRange.min;
    this.splitList = [];
    var radius = 1;
    while (index < dataRange.max) {
        this.splitList.push({
            start: index,
            end: index + splitNum,
            radius: radius,
            color: this.colors[radius - 1]
        });
        index += splitNum;
        radius++;
    }
};
;/* globals Drawer, util */

function BubbleDrawer() {
    Drawer.apply(this, arguments);
}

util.inherits(BubbleDrawer, Drawer);

BubbleDrawer.prototype.drawMap = function (mapv, ctx) {

    var data = this._layer.getData();

    ctx.save();

    var drawOptions = this.drawOptions;

    if (drawOptions.globalCompositeOperation) {
        ctx.globalCompositeOperation = drawOptions.globalCompositeOperation;
    }

    ctx.fillStyle = drawOptions.fillStyle || 'rgba(50, 50, 200, 0.8)';
    ctx.strokeStyle = drawOptions.strokeStyle;
    ctx.lineWidth = drawOptions.lineWidth || 1;

    for (var i = 0, len = data.length; i < len; i++) {
        var item = data[i];
        var radius = this.getRadius(item.count);
        ctx.beginPath();
        ctx.arc(item.px, item.py, radius, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        if (drawOptions.strokeStyle) {
            ctx.stroke();
        }
    }

    ctx.restore();
}

BubbleDrawer.prototype.getRadius = function (val) {

    var radius = 1;
    var splitList = this.splitList;

    for (var i = 0; i < splitList.length; i++) {
        if ((splitList[i].start === undefined
        || splitList[i].start !== undefined
        && val >= splitList[i].start)
        && (splitList[i].end === undefined
        || splitList[i].end !== undefined && val < splitList[i].end)) {
            radius = splitList[i].radius;
            break;
        }
    }

    return radius;

};

BubbleDrawer.prototype.drawDataRange = function () {
    var canvas = this.mapv.getDataRangeCtrol().getContainer();
    canvas.width = 100;
    canvas.height = 190;
    canvas.style.width = '100px';
    canvas.style.height = '190px';
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = this.drawOptions.fillStyle || 'rgba(50, 50, 200, 0.8)';
    var splitList = this.splitList;

    for (var i = 0; i < splitList.length; i++) {
        ctx.beginPath();
        ctx.arc(15, i * 25 + 20, splitList[i].radius, 0, Math.PI * 2, false);
        var startText = splitList[i].start || '~';
        var endText = splitList[i].end || '~';
        var text =  startText + ' - ' + endText;
        ctx.fillText(text, 25, i * 25 + 25);
        ctx.closePath();
        ctx.fill();
    }
};
;/* globals Drawer, util */

function CategoryDrawer() {
    Drawer.apply(this, arguments);
}

util.inherits(CategoryDrawer, Drawer);

CategoryDrawer.prototype.drawMap = function (mapv, ctx) {

    var data = this._layer.getData();

    var drawOptions = this.drawOptions;

    ctx.strokeStyle = drawOptions.strokeStyle;

    var radius = drawOptions.radius;
    for (var i = 0, len = data.length; i < len; i++) {
        var item = data[i];
        ctx.beginPath();
        ctx.moveTo(item.px, item.py);
        ctx.fillStyle = this.getColor(item.count);
        ctx.arc(item.px, item.py, radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }

    if (drawOptions.strokeStyle) {
        ctx.stroke();
    }

};

CategoryDrawer.prototype.generalSplitList = function () {
    this.splitList = {
        other: 'rgba(255, 255, 0, 0.8)',
        1: 'rgba(253, 98, 104, 0.8)',
        2: 'rgba(255, 146, 149, 0.8)',
        3: 'rgba(255, 241, 193, 0.8)',
        4: 'rgba(110, 176, 253, 0.8)',
        5: 'rgba(52, 139, 251, 0.8)',
        6: 'rgba(17, 102, 252)'
    };
};

CategoryDrawer.prototype.drawDataRange = function () {
    var canvas = this.mapv.getDataRangeCtrol().getContainer();
    canvas.width = 80;
    canvas.height = 190;
    canvas.style.width = "80px";
    canvas.style.height = "190px";

    var ctx = canvas.getContext("2d");

    var splitList = this.splitList;

    var i = 0;
    for (var key in splitList) {
        ctx.fillStyle = splitList[key];
        ctx.beginPath();
        ctx.arc(15, i * 25 + 15, 5, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillText(key, 25, i * 25 + 20);
        i++;
    }
};

CategoryDrawer.prototype.getColor = function (val) {
    var splitList = this.splitList;

    var color = splitList['other'];

    for (var i in splitList) {
        if (val == i) {
            color = splitList[i];
            break;
        }
    }
    
    return color;
};
;/* globals Drawer, util */

function ChoroplethDrawer() {
    Drawer.apply(this, arguments);
}

util.inherits(ChoroplethDrawer, Drawer);

ChoroplethDrawer.prototype.drawMap = function (mapv, ctx) {

    var data = this._layer.getData();

    var drawOptions = this.drawOptions;

    ctx.strokeStyle = drawOptions.strokeStyle;

    for (var i = 0, len = data.length; i < len; i++) {
        var item = data[i];
        ctx.fillStyle = this.getColor(item.count);
        ctx.beginPath();
        ctx.moveTo(item.px, item.py);
        ctx.arc(item.px, item.py, drawOptions.radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }

    if (drawOptions.strokeStyle) {
        ctx.stroke();
    }

};

ChoroplethDrawer.prototype.drawDataRange = function () {
    var canvas = this.mapv.getDataRangeCtrol().getContainer();
    var drawOptions = this.drawOptions;
    canvas.width = 100;
    canvas.height = 190;
    canvas.style.width = '100px';
    canvas.style.height = '190px';
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = drawOptions.fillStyle || 'rgba(50, 50, 200, 0.8)';

    var splitList = this.splitList;

    for (var i = 0; i < splitList.length; i++) {
        ctx.fillStyle = splitList[i].color;
        ctx.beginPath();
        ctx.arc(15, i * 25 + 15, drawOptions.radius, 0, Math.PI * 2, false);
        var text = (splitList[i].start || '~') + ' - ' + (splitList[i].end || '~');
        ctx.fillText(text, 25, i * 25 + 20);
        ctx.closePath();
        ctx.fill();
    }
};

ChoroplethDrawer.prototype.getColor = function (val) {
    var splitList = this.splitList;

    var color = 'yellow';

    for (var i = 0; i < splitList.length; i++) {
        if ((splitList[i].start === undefined || splitList[i].start !== undefined && val >= splitList[i].start) && (splitList[i].end === undefined || splitList[i].end !== undefined && val < splitList[i].end)) {
            color = splitList[i].color;
            break;
        }
    }
    
    return color;
};
;/* globals Drawer mercatorProjection BMap util */

var min;
var max;

function ClusterDrawer() {
    Drawer.apply(this, arguments);
}

util.inherits(ClusterDrawer, Drawer);

ClusterDrawer.prototype.drawMap = function (mapv, ctx) {
    // console.log('ClusterDrawer');
    window.console.time('computerMapData');
    // TODO: ser workder
    max = min = undefined;
    var data = this._layer.getData();

    var map = mapv.getMap();
    var zoom = map.getZoom();
    var zoomUnit = this.zoomUnit = Math.pow(2, 18 - zoom);

    // setMapStyle(map);

    var param = this.formatParam();
    // console.log(param)

    // console.log(param.gridWidth)
    var gridWidth = param.gridWidth;
    var fillColors = param.colors;

    var mercatorProjection = map.getMapType().getProjection();
    var mcCenter = mercatorProjection.lngLatToPoint(map.getCenter());
    var nwMcX = mcCenter.x - (map.getSize().width / 2) * zoomUnit;
    var nwMc = new BMap.Pixel(nwMcX, mcCenter.y + (map.getSize().height / 2) * zoomUnit);
    // 左上角墨卡托坐标

    var gridStep = gridWidth / zoomUnit;

    var startXMc = parseInt(nwMc.x / gridWidth, 10) * gridWidth;
    var startX = (startXMc - nwMc.x) / zoomUnit;

    var stockXA = [];
    var stickXAIndex = 0;
    while ((startX + stickXAIndex * gridStep) < map.getSize().width) {
        var value = startX + stickXAIndex * gridStep;
        stockXA.push(value.toFixed(2));
        stickXAIndex++;
    }

    var startYMc = parseInt(nwMc.y / gridWidth, 10) * gridWidth + gridWidth;
    var startY = (nwMc.y - startYMc) / zoomUnit;
    var stockYA = [];
    var stickYAIndex = 0;
    while ((startY + stickYAIndex * gridStep) < map.getSize().height) {
        value = startY + stickYAIndex * gridStep;
        stockYA.push(value.toFixed(2));
        stickYAIndex++;
    }

    var grids = {};
    for (var i = 0; i < stockXA.length; i++) {
        for (var j = 0; j < stockYA.length; j++) {
            var name = stockXA[i] + '_' + stockYA[j];
            grids[name] = 0;
        }
    }

    for (var i = 0; i < data.length; i++) {
        var x = data[i].px;
        var y = data[i].py;
        var val = parseInt(data[i].count, 10);
        var isSmallX = x < stockXA[0];
        var isSmallY = y < stockYA[0];
        var isBigX = x > (Number(stockXA[stockXA.length - 1]) + Number(gridStep));
        var isBigY = y > (Number(stockYA[stockYA.length - 1]) + Number(gridStep));
        if (isSmallX || isSmallY || isBigX || isBigY) {
            continue;
        }
        for (var j = 0; j < stockXA.length; j++) {
            var dataX = Number(stockXA[j]);
            if ((x >= dataX) && (x < dataX + gridStep)) {
                for (var k = 0; k < stockYA.length; k++) {
                    var dataY = Number(stockYA[k]);
                    if ((y >= dataY) && (y < dataY + gridStep)) {
                        // grids[stockXA[j] + '_' + stockYA[k]] += 1;
                        grids[stockXA[j] + '_' + stockYA[k]] += val;
                        val = grids[stockXA[j] + '_' + stockYA[k]];
                    }
                }
            }
        }
        min = min || val;
        max = max || val;
        min = min > val ? val : min;
        max = max < val ? val : max;
    }

    var step = (max - min + 1) / 10;
    window.console.timeEnd('computerMapData');

    window.console.time('drawMap');
    for (var i in grids) {
        var sp = i.split('_');
        x = Number(sp[0]);
        y = Number(sp[1]);
        var v = (grids[i] - min) / step;
        v = v < 0 ? 0 : v;
        var color = fillColors[v | 0];


        // if (grids[i] === 0) {
        //     ctx.fillStyle = 'rgba(255,255,255,0.1)';
        // } else {
        //     ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.4)';
        // }

        var cx = x + gridStep / 2;
        var cy = y + gridStep / 2;
        ctx.fillStyle = '#fa8b2e';
        // ctx.fillRect(x, y, 2, 2);
        ctx.beginPath();

        ctx.arc(cx, cy, v * 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 8 * v / 10;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // if (this.drawOptions.showNum) {
        ctx.save();
        // ctx.fillStyle = 'black';
        ctx.font = 30 * v / 10 + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (grids[i] !== 0) {

            ctx.fillStyle = '#fff';
            ctx.fillText(grids[i], cx, cy);
        }
        ctx.restore();
        // }
    }
    // this.drawDataRange(mapv._dataRangeCtrol.getContainer());
    window.console.timeEnd('drawMap');
    // console.timeEnd('drawMap')
};

// ClusterDrawer.prototype.drawDataRange = function (canvas, data, drawOptions) {
// };

/**
 * format param
 * @return {[type]} [description]
 */
ClusterDrawer.prototype.formatParam = function () {

    // console.log('AAA')
    var options = this.drawOptions;
    // console.log(options)
    var fillColors = this.fillColors = [
        [73, 174, 34],
        [119, 191, 26],
        [160, 205, 18],
        [202, 221, 10],
        [248, 237, 1],
        [225, 222, 3],
        [254, 182, 10],
        [254, 126, 19],
        [254, 84, 27],
        [253, 54, 32]
    ];

    this.colorBar = {};
    for (var i = 0; i < fillColors.length; i++) {
        var pos = (i + 1) / fillColors.length;
        var r = fillColors[i][0];
        var g = fillColors[i][1];
        var b = fillColors[i][2];
        this.colorBar[pos] = 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    var gridWidth = 60 || options.gridWidth || '50';
    // console.log(gridWidth, '@@@@@@')
    gridWidth = gridWidth + (options.gridUnit || 'px');
    if (/px$/.test(gridWidth)) {
        gridWidth = parseInt(gridWidth, 10) * this.zoomUnit;
    } else {
        gridWidth = parseInt(gridWidth, 10);
    }
    // console.log(gridWidth, options.gridWidth)
    return {
        gridWidth: gridWidth,
        colors: fillColors
    };
};
;/* globals Drawer mercatorProjection BMap util */

var min;
var max;


function DensityDrawer() {
    this.Scale;
    this.masker = {};
    this.mapv = null;
    this.ctx = null;
    Drawer.apply(this, arguments);
}

util.inherits(DensityDrawer, Drawer);

DensityDrawer.prototype.scale = function (scale) {
    var self = this;
    scale.change(function (min, max) {
        self.masker = {
            min: min,
            max: max
        };

        self.ctx.clearRect(0, 0, self.ctx.canvas.width, self.ctx.canvas.height);
        self.drawMap();
        // window.console.log(min, max);
    });
    this.Scale = scale;
};

DensityDrawer.prototype.drawMap = function (mapv, ctx) {
    mapv = this.mapv = this.mapv || mapv;
    ctx = this.ctx = this.ctx || ctx;

    // TODO: ser workder
    max = min = undefined;
    var data = this._layer.getData();

    var map = mapv.getMap();
    var zoom = map.getZoom();
    var zoomUnit = this.zoomUnit = Math.pow(2, 18 - zoom);

    // setMapStyle(map);

    var param = formatParam.call(this);
    var gridWidth = param.gridWidth;
    var fillColors = param.colors;

    var mcCenter = mercatorProjection.lngLatToPoint(map.getCenter());
    var nwMcX = mcCenter.x - (map.getSize().width / 2) * zoomUnit;
    var nwMc = new BMap.Pixel(nwMcX, mcCenter.y + (map.getSize().height / 2) * zoomUnit);
    // 左上角墨卡托坐标

    var gridStep = gridWidth / zoomUnit;

    var startXMc = parseInt(nwMc.x / gridWidth, 10) * gridWidth;
    var startX = (startXMc - nwMc.x) / zoomUnit;

    var stockXA = [];
    var stickXAIndex = 0;
    while ((startX + stickXAIndex * gridStep) < map.getSize().width) {
        var value = startX + stickXAIndex * gridStep;
        stockXA.push(value.toFixed(2));
        stickXAIndex++;
    }

    var startYMc = parseInt(nwMc.y / gridWidth, 10) * gridWidth + gridWidth;
    var startY = (nwMc.y - startYMc) / zoomUnit;
    var stockYA = [];
    var stickYAIndex = 0;
    while ((startY + stickYAIndex * gridStep) < map.getSize().height) {
        value = startY + stickYAIndex * gridStep;
        stockYA.push(value.toFixed(2));
        stickYAIndex++;
    }

    var grids = {};
    for (var i = 0; i < stockXA.length; i++) {
        for (var j = 0; j < stockYA.length; j++) {
            var name = stockXA[i] + '_' + stockYA[j];
            grids[name] = 0;
        }
    }

    for (var i = 0; i < data.length; i++) {
        var x = data[i].px;
        var y = data[i].py;
        var val = parseInt(data[i].count, 10);
        var isSmallX = x < stockXA[0];
        var isSmallY = y < stockYA[0];
        var isBigX = x > (Number(stockXA[stockXA.length - 1]) + Number(gridStep));
        var isBigY = y > (Number(stockYA[stockYA.length - 1]) + Number(gridStep));
        if (isSmallX || isSmallY || isBigX || isBigY) {
            continue;
        }
        for (var j = 0; j < stockXA.length; j++) {
            var dataX = Number(stockXA[j]);
            if ((x >= dataX) && (x < dataX + gridStep)) {
                for (var k = 0; k < stockYA.length; k++) {
                    var dataY = Number(stockYA[k]);
                    if ((y >= dataY) && (y < dataY + gridStep)) {
                        // grids[stockXA[j] + '_' + stockYA[k]] += 1;
                        grids[stockXA[j] + '_' + stockYA[k]] += val;
                        val = grids[stockXA[j] + '_' + stockYA[k]];
                    }
                }
            }
        }
        min = min || val;
        max = max || val;
        min = min > val ? val : min;
        max = max < val ? val : max;
    }

    var step = (max - min + 1) / 10;
    window.console.timeEnd('computerMapData');

    window.console.time('drawMap');
    for (var i in grids) {
        var sp = i.split('_');
        x = sp[0];
        y = sp[1];
        var v = (grids[i] - min) / step;
        var color = fillColors[v | 0];

        var isTooSmall = this.masker.min && (grids[i] < this.masker.min);
        var isTooBig = this.masker.max && (grids[i] > this.masker.max);
        if (grids[i] === 0 || isTooSmall || isTooBig) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
        } else {
            ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.4)';
        }
        ctx.fillRect(x, y, gridStep - 1, gridStep - 1);

        if (this.drawOptions.showNum) {
            ctx.save();
            // ctx.fillStyle = 'black';
            ctx.textBaseline = 'top';
            if (grids[i] !== 0 && !isTooSmall && !isTooBig) {
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillText(grids[i], x, y);

            }
            ctx.restore();
        }
    }
    // this.drawDataRange(mapv._dataRangeCtrol.getContainer());
    window.console.timeEnd('drawMap');
    // console.timeEnd('drawMap')

    // console.log()
    this.Scale && this.Scale.set({
        max: max,
        min: min,
        colors: 'default'
    });
};

// DensityDrawer.prototype.drawDataRange = function (canvas, data, drawOptions) {
//     canvas.width = 30;
//     canvas.height = 256;
//     canvas.style.width = '30px';
//     canvas.style.height = '256px';

//     var ctx = canvas.getContext('2d');

//     var gradient = ctx.createLinearGradient(0, 0, 0, 256);

//     // canvas.width = 1;
//     // canvas.height = 256;

//     var grad = this.colorBar;

//     for (var i in grad) {
//         gradient.addColorStop(i, grad[i]);
//     }

//     ctx.fillStyle = gradient;
//     ctx.fillRect(2, 10, 7, 236);

//     // draw max and min
//     ctx.beginPath();
//     ctx.moveTo(10, 10);
//     ctx.lineTo(13, 10);
//     ctx.stroke();
//     ctx.font = '10px sans-serif';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(min || 0, 15, 10);

//     ctx.beginPath();
//     ctx.moveTo(10, 246);
//     ctx.lineTo(13, 246);
//     ctx.stroke();
//     ctx.font = '10px sans-serif';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(max || 0, 15, 246);

//     // console.log(max, min)
// };

/**
 * format param
 * @return {[type]} [description]
 */
function formatParam() {

    var options = this.drawOptions;
    // console.log(options)
    var fillColors = this.fillColors = [
        [73, 174, 34],
        [119, 191, 26],
        [160, 205, 18],
        [202, 221, 10],
        [248, 237, 1],
        [225, 222, 3],
        [254, 182, 10],
        [254, 126, 19],
        [254, 84, 27],
        [253, 54, 32]
    ];

    this.colorBar = {};
    for (var i = 0; i < fillColors.length; i++) {
        var pos = (i + 1) / fillColors.length;
        var r = fillColors[i][0];
        var g = fillColors[i][1];
        var b = fillColors[i][2];
        this.colorBar[pos] = 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    var gridWidth = options.gridWidth || '50';
    gridWidth = gridWidth + (options.gridUnit || 'px');
    if (/px$/.test(gridWidth)) {
        gridWidth = parseInt(gridWidth, 10) * this.zoomUnit;
    } else {
        gridWidth = parseInt(gridWidth, 10);
    }
    // console.log(gridWidth, options.gridWidth)
    return {
        gridWidth: gridWidth,
        colors: fillColors
    };
}
;/* globals Drawer, util drawOptions map*/

function HeatmapDrawer() {
    var self = this;
    self.masker = {};
    Drawer.apply(this, arguments);
    this._max = 20;
    this._data = [];
}

util.inherits(HeatmapDrawer, Drawer);

HeatmapDrawer.prototype.drawMap = function (mapv, ctx) {
    var self = this;
    mapv = self.mapv = self.mapv || mapv;
    ctx = self.ctx = self.ctx || ctx;
    this._ctx = ctx;
    this._map = map;
    this._width = ctx.canvas.width;
    this._height = ctx.canvas.height;
    var data = this._layer.getData();
    // var drawOptions = this.drawOptions;
    this._data = data;
    this.drawHeatmap();

    self.Scale.set({
        min: 0,
        max: self.getMax(),
        colors: this.getGradient()
    });
};

HeatmapDrawer.prototype.scale = function (scale) {
    var self = this;

    scale.change(function (min, max) {
        self.masker = {
            min: min,
            max: max
        };

        self.drawMap();
    });
    self.Scale = scale;
};

// HeatmapDrawer.prototype.drawDataRange = function () {
//     var canvas = this.mapv.getDataRangeCtrol().getContainer();
//     canvas.width = 60;
//     canvas.height = 160;
//     canvas.style.width = '60px';
//     canvas.style.height = '160px';

//     var ctx = canvas.getContext('2d');

//     var gradient = ctx.createLinearGradient(0, 0, 0, 160);

//     var grad = this.getGradient();

//     for (var i in grad) {
//         gradient.addColorStop(i, grad[i]);
//     }

//     ctx.fillStyle = gradient;
//     ctx.fillRect(5, 5, 30, 150);

//     ctx.fillStyle = '#333';
//     ctx.fillText(0, 37, 15);
//     ctx.fillText(this.getMax(), 37, 153);
// };

util.extend(HeatmapDrawer.prototype, {

    defaultRadius: 10,

    defaultGradient: {
        '0.4': 'blue',
        '0.6': 'cyan',
        '0.7': 'lime',
        '0.8': 'yellow',
        '1.0': 'red'
    },

    getGradient: function () {
        return this.drawOptions.gradient || this.defaultGradient;
    },

    getRadius: function () {
        var zoom = this._map.getZoom();
        var zoomUnit = Math.pow(2, 18 - zoom);
        var distance = this.drawOptions.radius || 200;
        return distance / zoomUnit;
    },

    getMax: function () {
        var max = this._max;
        if (this.drawOptions.max !== undefined) {
            max = this.drawOptions.max;
        } else {
            var dataRange = this.mapv.geoData.getDataRange();
            max = dataRange.min + (dataRange.max - dataRange.min) * 0.7;
        }
        return max;
    },

    data: function (data) {
        this._data = data;
        return this;
    },

    max: function (max) {
        this._max = max;
        return this;
    },

    add: function (point) {
        this._data.push(point);
        return this;
    },

    clear: function () {
        this._data = [];
        return this;
    },

    radius: function (r, blur) {
        blur = blur || 15;

        // create a grayscale blurred circle image that we'll use for drawing points
        var circle = this._circle = document.createElement('canvas'),
            ctx = circle.getContext('2d'),
            r2 = this._r = r + blur;

        if (this.drawOptions.type === 'rect') {
            circle.width = circle.height = r2;
        } else {
            circle.width = circle.height = r2 * 2;
        }

        ctx.shadowOffsetX = ctx.shadowOffsetY = 200;
        if (this.drawOptions.blur) {
            ctx.shadowBlur = blur;
        }
        ctx.shadowColor = 'black';

        ctx.beginPath();
        if (this.drawOptions.type === 'rect') {
            ctx.fillRect(-200, -200, circle.width, circle.height);
        } else {
            ctx.arc(r2 - 200, r2 - 200, r, 0, Math.PI * 2, true);
        }
        ctx.closePath();
        ctx.fill();

        return this;
    },

    gradient: function (grad) {
        // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    drawHeatmap: function (minOpacity) {
        // if (!this._circle) {
        this.radius(this.getRadius());
        // }
        // if (!this._grad) {
        this.gradient(this.getGradient());
        // }

        var ctx = this._ctx;

        ctx.clearRect(0, 0, this._width, this._height);

        // console.log(this.masker)
        // draw a grayscale heatmap by putting a blurred circle at each data point
        for (var i = 0, len = this._data.length, p; i < len; i++) {
            p = this._data[i];
            if (p.px < 0 || p.py < 0 || p.px > ctx.canvas.width || p.py > ctx.canvas.height) {
                continue;
            }
            // if (p.count < this.masker.min || p.count > this.masker.max) {
            //     continue;
            // }
            // console.log(p.count)
            ctx.globalAlpha = Math.max(p.count / this.getMax(), minOpacity === undefined ? 0.05 : minOpacity);
            ctx.drawImage(this._circle, p.px - this._r, p.py - this._r);
        }

        // colorize the heatmap, using opacity value of each pixel to get the right color from our gradient
        // console.log( this._width, this._height)
        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this.colorize(colored.data, this._grad);
        ctx.putImageData(colored, 0, 0);

        return this;
    },

    colorize: function (pixels, gradient) {
        var jMin = 0;
        var jMax = 1024;
        if (this.masker.min) {
            jMin = this.masker.min / this.getMax() * 1024;
        }

        if (this.masker.max) {
            jMax = this.masker.max / this.getMax() * 1024;
        }

        for (var i = 3, len = pixels.length, j; i < len; i += 4) {
            j = pixels[i] * 4; // get gradient color from opacity value

            var maxOpacity = this.drawOptions.maxOpacity || 0.8;
            if (pixels[i] / 256 > maxOpacity) {
                pixels[i] = 256 * maxOpacity;
            }

            if (j && j >= jMin && j <= jMax) {
                pixels[i - 3] = gradient[j];
                pixels[i - 2] = gradient[j + 1];
                pixels[i - 1] = gradient[j + 2];
            } else {
                pixels[i] = 0;
            }
        }
    }
});
;/* globals Drawer, util */

function IntensityDrawer() {
    this.masker = {
        min: 0,
        max: 0
    };
    Drawer.apply(this, arguments);

    // 临时canvas，用来绘制颜色条，获取颜色
    this._tmpCanvas = document.createElement('canvas');
    this.gradient(this.defaultGradient);
}

util.inherits(IntensityDrawer, Drawer);

IntensityDrawer.prototype.defaultGradient = {
    '0.0': 'yellow',
    '1.0': 'red'
};

IntensityDrawer.prototype.drawMap = function (mapv, ctx) {
    var self = this;
    mapv = self.mapv = self.mapv || mapv;
    ctx = self.ctx = self.ctx || ctx;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var data = this._layer.getData();
    var drawOptions = this.drawOptions;
    ctx.strokeStyle = drawOptions.strokeStyle;

    var ctxW = ctx.canvas.width;
    var ctxH = ctx.canvas.height;

    window.console.time('drawMap');

    for (var i = 0, len = data.length; i < len; i++) {
        var item = data[i];
        if (item.px < 0 || item.px > ctxW || item.py < 0 || item.py > ctxH) {
            continue;
        }
        var isTooSmall = self.masker.min && (item.count < self.masker.min);
        var isTooBig = self.masker.max && (item.count > self.masker.max);
        if (isTooSmall || isTooBig) {
            continue;
        }
        ctx.beginPath();
        ctx.moveTo(item.px, item.py);
        ctx.fillStyle = this.getColor(item.count);
        ctx.arc(item.px, item.py, drawOptions.radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    }

    window.console.timeEnd('drawMap');

    if (drawOptions.strokeStyle) {
        ctx.stroke();
    }

    this.Scale.set({
        min: 0,
        max: self.getMax()
    });
};

IntensityDrawer.prototype.scale = function (scale) {
    var self = this;

    scale.change(function (min, max) {
        self.masker = {
            min: min,
            max: max
        };

        self.drawMap();
    });
    self.Scale = scale;
};

IntensityDrawer.prototype.getMax = function () {
    var dataRange = this.mapv.geoData.getDataRange();
    var max = dataRange.max;

    if (this.drawOptions.max) {
        max = this.drawOptions.max;
    }
    return max;
};

IntensityDrawer.prototype.getColor = function (val) {
    var max = this.getMax();

    var index = val / max;
    if (index > 1) {
        index = 1;
    }
    index *= 255;
    index = parseInt(index, 10);
    index *= 4;

    var color = 'rgba(' + this._grad[index] + ', ' + this._grad[index + 1] + ', ' + this._grad[index + 2] + ',0.8)';
    return color;
};

IntensityDrawer.prototype.gradient = function (grad) {
    // create a 256x1 gradient
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 256);

    canvas.width = 1;
    canvas.height = 256;

    for (var i in grad) {
        gradient.addColorStop(i, grad[i]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);

    this._grad = ctx.getImageData(0, 0, 1, 256).data;

    return this;
};
;/* globals Drawer, util */

function SimpleDrawer() {
    Drawer.apply(this, arguments);
}

util.inherits(SimpleDrawer, Drawer);

SimpleDrawer.prototype.drawMap = function (mapv, ctx) {

    var data = this._layer.getData();

    var drawOptions = this.drawOptions;

    ctx.fillStyle = drawOptions.fillStyle || "rgba(50, 50, 200, 0.8)";
    ctx.strokeStyle = drawOptions.strokeStyle;
    ctx.lineWidth = drawOptions.lineWidth || 1;

    ctx.beginPath();

    if (drawOptions.globalCompositeOperation) {
        ctx.globalCompositeOperation = drawOptions.globalCompositeOperation;
    }

    var radius = drawOptions.radius || 3;
    // console.log(data);
    for (var i = 0, len = data.length; i < len; i++) {
        var item = data[i];
        if (item.px < 0 || item.px > ctx.canvas.width || item.py < 0 || item > ctx.canvas.height) {
            continue;
        }
        ctx.moveTo(item.px, item.py);
        ctx.arc(item.px, item.py, radius, 0, 2 * Math.PI, false);
    }

    if (drawOptions.strokeStyle) {
        ctx.stroke();
    }

    ctx.fill();
}
;
    Mapv.Layer = Layer;

    this.Mapv = Mapv;

}();
