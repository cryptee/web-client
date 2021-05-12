var lineHeightConfig = {
    scope: Parchment.Scope.BLOCK,
    whitelist: [ '1.5rem', '1.725rem' ,'1.875rem', '2.25rem', '2.625rem', '3rem', '4.5rem' ]
};
var lineHeightClass = new Parchment.Attributor.Class('lineheight', 'ql-line-height', lineHeightConfig);
var lineHeightStyle = new Parchment.Attributor.Style('lineheight', 'line-height',    lineHeightConfig);
Parchment.register(lineHeightClass);
Parchment.register(lineHeightStyle);
Quill.register(lineHeightClass, true);
Quill.register(lineHeightStyle, true);