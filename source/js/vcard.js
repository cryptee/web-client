
// exported globals
var VCard;

(function() {

    VCard = function(attributes) {
	      this.changed = false;
        if(typeof(attributes) === 'object') {
            for(var key in attributes) {
                this[key] = attributes[key];
	              this.changed = true;
            }
        }
    };

    VCard.prototype = {

	      // Check validity of this VCard instance. Properties that can be generated,
	      // will be generated. If any error is found, false is returned and vcard.errors
	      // set to an Array of [attribute, errorType] arrays.
	      // Otherwise true is returned.
	      //
	      // In case of multivalued properties, the "attribute" part of the error is
	      // the attribute name, plus it's index (starting at 0). Example: email0, tel7, ...
	      //
	      // It is recommended to call this method even if this VCard object was imported,
	      // as some software (e.g. Gmail) doesn't generate UIDs.
	      validate: function() {
	          var errors = [];

	          function addError(attribute, type) {
		            errors.push([attribute, type]);
	          }

	          if(! this.fn) { // FN is a required attribute
		            addError("fn", "required");
	          }

	          // make sure multivalued properties are *always* in array form
	          for(var key in VCard.multivaluedKeys) {
		            if(this[key] && ! (this[key] instanceof Array)) {
                    this[key] = [this[key]];
		            }
	          }

	          // make sure compound fields have their type & value set
	          // (to prevent mistakes such as vcard.addAttribute('email', 'foo@bar.baz')
	          function validateCompoundWithType(attribute, values) {
		            for(var i in values) {
		                var value = values[i];
		                if(typeof(value) !== 'object') {
			                  errors.push([attribute + '-' + i, "not-an-object"]);
		                } else if(! value.type) {
			                  errors.push([attribute + '-' + i, "missing-type"]);
		                } else if(! value.value) { // empty values are not allowed.
			                  errors.push([attribute + '-' + i, "missing-value"]);
		                }
		            }
	          }

	          if(this.email) {
		            validateCompoundWithType('email', this.email);
	          }

	          if(this.tel) {
		            validateCompoundWithType('email', this.tel);
	          }

	          if(! this.uid) {
		            this.addAttribute('uid', this.generateUID());
	          }

	          if(! this.rev) {
		            this.addAttribute('rev', this.generateRev());
	          }

	          this.errors = errors;

	          return ! (errors.length > 0);
	      },

	      // generate a UID. This generates a UUID with uuid: URN namespace, as suggested
	      // by RFC 6350, 6.7.6
	      generateUID: function() {
	          return 'uuid:' + Math.uuid();
	      },

	      // generate revision timestamp (a full ISO 8601 date/time string in basic format)
	      generateRev: function() {
	          return (new Date()).toISOString().replace(/[\.\:\-]/g, '');
	      },

	      // Set the given attribute to the given value.
	      // This sets vcard.changed to true, so you can check later whether anything
	      // was updated by your code.
        setAttribute: function(key, value) {
            this[key] = value;
	          this.changed = true;
        },

	      // Set the given attribute to the given value.
	      // If the given attribute's key has cardinality > 1, instead of overwriting
	      // the current value, an additional value is appended.
        addAttribute: function(key, value) {
            console.log('add attribute', key, value);
            if(! value) {
                return;
            }
            if(VCard.multivaluedKeys[key]) {
                if(this[key]) {
                    console.log('multivalued push');
                    this[key].push(value)
                } else {
                    console.log('multivalued set');
                    this.setAttribute(key, [value]);
                }
            } else {
                this.setAttribute(key, value);
            }
        },

	      // convenience method to get a JSON serialized jCard.
	      toJSON: function() {
	          return JSON.stringify(this.toJCard());
	      },

	      // Copies all properties (i.e. all specified in VCard.allKeys) to a new object
	      // and returns it.
	      // Useful to serialize to JSON afterwards.
        toJCard: function() {
            var jcard = {};
            for(var k in VCard.allKeys) {
                var key = VCard.allKeys[k];
                if(this[key]) {
                    jcard[key] = this[key];
                }
            }
            return jcard;
        },

        // synchronizes two vcards, using the mechanisms described in
        // RFC 6350, Section 7.
        // Returns a new VCard object.
        // If a property is present in both source vcards, and that property's
        // maximum cardinality is 1, then the value from the second (given) vcard
        // precedes.
        //
        // TODO: implement PID matching as described in 7.3.1
        merge: function(other) {
            if(typeof(other.uid) !== 'undefined' &&
               typeof(this.uid) !== 'undefined' &&
               other.uid !== this.uid) {
                // 7.1.1
                throw "Won't merge vcards without matching UIDs.";
            }

            var result = new VCard();

            function mergeProperty(key) {
                if(other[key]) {
                    if(other[key] == this[key]) {
                        result.setAttribute(this[key]);
                    } else {
                        result.addAttribute(this[key]);
                        result.addAttribute(other[key]);
                    }
                } else {
                    result[key] = this[key];
                }
            }

            for(key in this) { // all properties of this
                mergeProperty(key);
            }
            for(key in other) { // all properties of other *not* in this
                if(! result[key]) {
                    mergeProperty(key);
                }
            }
        }
    };

    VCard.enums = {
        telType: ["text", "voice", "fax", "cell", "video", "pager", "textphone"],
        relatedType: ["contact", "acquaintance", "friend", "met", "co-worker",
                      "colleague", "co-resident", "neighbor", "child", "parent",
                      "sibling", "spouse", "kin", "muse", "crush", "date",
                      "sweetheart", "me", "agent", "emergency"],
        // FIXME: these aren't actually defined anywhere. just very commmon.
        //        maybe there should be more?
        emailType: ["work", "home", "internet"],
        langType: ["work", "home"],
        
    };

    VCard.allKeys = [
        'fn', 'n', 'nickname', 'photo', 'bday', 'anniversary', 'gender',
        'tel', 'email', 'impp', 'lang', 'tz', 'geo', 'title', 'role', 'logo',
        'org', 'member', 'related', 'categories', 'note', 'prodid', 'rev',
        'sound', 'uid'
    ];

    VCard.multivaluedKeys = {
        email: true,
        tel: true,
        geo: true,
        title: true,
        role: true,
        logo: true,
        org: true,
        member: true,
        related: true,
        categories: true,
        note: true
    };

})();
