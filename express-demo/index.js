const express = require('express')
const app = express()
const path = require('path')

let { user } = require('./model/user.js')

let indexRouter = require('./routes/index.js')
let usersRouter = require('./routes/users.js')

let mongoose = require('mongoose'); //导入组件
let db = mongoose.createConnection('127.0.0.1', 'blog'); //连接数据库

db.on('error', () => {
    console.error('数据库链接错误');
    db.disconnect()
})


let router = express.Router();

db.on('open', () => {
    console.info('数据库已连接')

    app.get('/', (req, res, next) => {
        user.find(function (error, result){
            if (error) {
                res.send(error)
            } else {
                res.send(result)
            }
        })
    })

})

// app.use((req, res, next) => {
//   console.log(1)
//   next(new Error())
// })

// app.use((req, res) => {
//   console.log(2)
//   res.status(200).end()
// })

//错误处理

// app.use((err, req, res, next) => {
//   console.error(err.stack)
//   res.status(500).send('Something broke.')
// })

// app.use('/', indexRouter)
// app.use('/users/', usersRouter)

// 设置模板引擎
// app.set('views', path.join(__dirname, 'views'))// 设置模板的存放的路径
// 设置模板引擎为 ejs
// app.set('view engine', 'ejs')


app.listen(3000)
