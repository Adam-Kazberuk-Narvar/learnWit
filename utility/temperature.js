var temperatureUtility = {
    convertKelvinToF: function convertKelvinToF(kelvinTemp){
      return (9/5) * kelvinTemp - 459.67;
    }
    convertKelvinToC: function convertKelvinToC(kelvinTemp){
      return kelvinTemp - 273.15;
    }
    convertKelvin: function convertKelvin(kelvinTemp){
      var convertedArr = [];
      for(var i=0; i<arguments.length; i++){
        convertedArr.push({
          f: convertKelvinToF(arguments[i]),
          c: convertKelvinToC(arguments[i])
        })
      }
      return convertedArr;
    }
}

module.exports = temperatureUtility;
