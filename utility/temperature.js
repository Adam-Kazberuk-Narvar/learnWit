function temperatureUtility(){
  var self = {};
  self.convertKelvinToF = function convertKelvinToF(kelvinTemp){
    return (9/5) * kelvinTemp - 459.67;
  };

  self.convertKelvinToC = function convertKelvinToC(kelvinTemp){
    return kelvinTemp - 273.15;
  };

  self.convertKelvin = function convertKelvin(kelvinTemp){
    var convertedArr = [];
    for(var i=0; i<arguments.length; i++){
      convertedArr.push({
        f: convertKelvinToF(arguments[i]),
        c: convertKelvinToC(arguments[i])
      })
    }
    return convertedArr;
  }

  return self;
}

module.exports = temperatureUtility();
