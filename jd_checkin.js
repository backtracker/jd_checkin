const puppeteer = require('puppeteer');
const fs = require('fs');
const winston = require('winston')
const datetime = require('node-datetime');
const cookies =  JSON.parse(fs.readFileSync('./jd_cookie.txt', 'utf8'))


async function switchPageByTitle(browser,page_title) {
    const viewPort={width:1920, height:1080};
    var expected_page = null;
    const allPages =  await browser.pages();
    for (var i = 0; i < allPages.length; i++) {
        var page = allPages[i];
        var current_title = await page.title();
        if (current_title.indexOf(page_title) != -1 ){
            expected_page = page
            expected_page.setViewport(viewPort)
            return expected_page
        }
    }
    return expected_page
}

function  getFormatedTime() {
    return new  datetime.create().format("Y-m-d_H-M-S")
}


// 格式化输出内容
const formatter = winston.format.combine(
    winston.format.json(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => {
        const showInfo = { time: info.timestamp,  message: info.message ,level: info.level} ;
        return JSON.stringify(showInfo)
    })
)


const logger = winston.createLogger({
    level: 'info',
    //format: winston.format.json(),
    format: formatter,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/jd_checkin.log' })
    ]
});

(async() => {
    var browser = null;
    try {
        logger.info("开始启动京东签到脚本...")
        const viewPort={width:1920, height:1080};
        browser = await puppeteer.launch({headless:false});
        //browser = await puppeteer.launch({executablePath: '/usr/bin/chromium'});

        const url = 'https://vip.jd.com/';
        const page = await browser.newPage();
        await page.setViewport(viewPort)

        await page.setCookie(...cookies);
        await page.goto(url);
        try {
            await page.waitFor('.sign-in')
        }catch (e) {
            logger.error("未找到签到按钮，检查cookie是否过期！")
            await page.screenshot({path: 'screenshots/'+"jd_login_error_"+getFormatedTime()+'.png'});
            await browser.close();
            return -1;
        }

        const sign_in_status = await page.$eval('.sign-in > .name', element => element.innerText)
        //console.log(sign_in_status)
        if(sign_in_status == "已签到" ){
            logger.info("进行签到...")
            await page.click('.icon-sign')
            await page.waitFor(3000)
            const sing_page = await switchPageByTitle(browser,"签到页");
            if (null != sing_page){
                const sing_message = await sing_page.$eval('div.day-info.second-day.active > div.active-info > div.title', element => element.innerText);
                logger.info(sing_message)
                await sing_page.screenshot({path: "screenshots/jd_sign_page_"+getFormatedTime()+".png"});
            }else {
                logger.error("未找到签到页")
            }

            await page.reload()
            logger.info("当前签到状态："+await page.$eval('.sign-in > .name', element => element.innerText))
            // await page.waitFor(2000)
        }else {
            logger.info("当前签到状态："+sign_in_status)
        }
        await page.screenshot({path: "screenshots/jd_checkin_"+getFormatedTime()+".png"});
        await browser.close();
    }catch (e) {
        logger.error(e)
        await browser.close();
    }

})();
