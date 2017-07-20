exports = module.exports = {
  convertKelvinToF: function convertKelvinToF(kelvinTemp){
    return ((9/5) * (kelvinTemp - 273.15) + 32).toFixed(2);
  },

  convertKelvinToC: function convertKelvinToC(kelvinTemp){
    return (kelvinTemp - 273.15).toFixed(2);
  },

  convertKelvin: function convertKelvin(kelvinTemp){
    var convertedArr = [];
    for(var i=0; i<arguments.length; i++){
      convertedArr.push({
        f: this.convertKelvinToF(arguments[i]),
        c: this.convertKelvinToC(arguments[i])
      })
    }
    return convertedArr;
  }
}
