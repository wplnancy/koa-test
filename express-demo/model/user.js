let mongoose = require('mongoose')

let Schema = mongoose.Schema

let userSchema = new Schema({
  name: 'String',
  age: 'String',
  location: 'String',
  likes: 'String'
})

export.user =  mongoose.model('user', userSchema)

`
