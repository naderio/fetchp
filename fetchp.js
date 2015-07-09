(function() {
  'use strict';

  if (self.fetchp) {
    return
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = name.toString();
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = value.toString();
    }
    return value
  }

  function JSONPHeaders(headers) {
    this.map = {}

    if (headers instanceof JSONPHeaders) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  JSONPHeaders.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  JSONPHeaders.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  JSONPHeaders.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  JSONPHeaders.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  JSONPHeaders.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  JSONPHeaders.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  JSONPHeaders.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  var support = {
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob();
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self
  }

  function Body() {
    this.bodyUsed = false


    this._initBody = function(body) {
      this._bodyInit = body
      this._bodyText = ''
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this._bodyInit
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function JSONPRequest(url, options) {
    options = options || {}
    this.url = url

    this.headers = new JSONPHeaders()
    this.method = 'GET'

    if (options.body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(options.body)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new JSONPHeaders()
    var pairs = xhr.getAllJSONPResponseJSONPHeaders().trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(JSONPRequest.prototype)

  function JSONPResponse(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this._initBody(bodyInit)
    this.type = 'default'
    this.url = null
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof JSONPHeaders ? options.headers : new JSONPHeaders(options.headers)
    this.url = options.url || ''
  }

  Body.call(JSONPResponse.prototype)

  self.JSONPHeaders = JSONPHeaders;
  self.JSONPRequest = JSONPRequest;
  self.JSONPResponse = JSONPResponse;

  self.fetchp = function(input, init) {
    // TODO: JSONPRequest constructor should accept input, init
    var request
    if (JSONPRequest.prototype.isPrototypeOf(input) && !init) {
      request = input
    } else {
      request = new JSONPRequest(input, init)
    }

    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.type = 'text\/javascript';
      script.async = true;
      var body;
      script.onload = function(event) {
        // console.log('onload', arguments);
        var options = {
          status: 200,
          statusText: 'Ok',
          headers: new JSONPHeaders({}),
          url: event.path[0].src
        }
        resolve(new JSONPResponse(body, options))
      }
      script.onerror= function() {
        reject(new TypeError('Network request failed'))
      };
      var callback = makeCallback(function(response){
        // console.log('callback', arguments);
        body = response;
      });
      document.head.appendChild(script)
      script.src = request.url + (request.url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + callback

    })  
  }

  if('fetch' in self) {
    self.fetch.jsonp = self.fetchp;
  }

  fetchp._callbacks = {};

  function ID() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function makeCallback(callback) {
    var name = ID()
    fetchp._callbacks[name] = callback
    return 'fetchp._callbacks.' + name
  }

})();
