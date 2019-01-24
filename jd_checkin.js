const puppeteer = require('puppeteer');
const fs = require('fs');
const winston = require('winston')
const datetime = require('node-datetime');
const cookies =  JSON.parse(fs.readFileSync('./jd_cookie.txt', 'utf8'))
const viewPort={width:1920, height:1080};

//根据网页title切换页面
async function switchPageByTitle(browser,page_title) {
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
//得到格式化时间戳
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

//每日签到
async function daily_checkin(browser){
    logger.info("开始京东每日签到...")
    try {
        const vip_url = 'https://vip.jd.com/';
        const vip_page = await browser.newPage();
        await vip_page.setViewport(viewPort)
        await vip_page.setCookie(...cookies);
        await vip_page.goto(vip_url);

        try {
            await vip_page.click('.ui-dialog-close')
        }catch (e) {}

        try {
            await vip_page.waitFor('.sign-in')
        }catch (e) {
            logger.error("每日签到失败！未找到签到按钮，检查cookie是否过期！")
            await vip_page.screenshot({path: 'screenshots/'+"jd_daily_checkin_error_"+getFormatedTime()+'.png'});
            await vip_page.close()
            return -1;
        }

        const sign_in_status = await vip_page.$eval('.sign-in > .name', element => element.innerText)
        if(sign_in_status == "签到" ){
            logger.info("进行签到...")
            await vip_page.click('.icon-sign')
            await vip_page.waitFor(3000)
            // const sing_page = await switchPageByTitle(browser,"签到页");
            // if (null != sing_page){
            //     const sing_message = await sing_page.$eval('div.day-info.second-day.active > div.active-info > div.title', element => element.innerText);
            //     logger.info(sing_message)
            //     await sing_page.screenshot({path: "screenshots/jd_sign_page_"+getFormatedTime()+".png"});
            // }else {
            //     logger.error("未找到签到页")
            // }

            await vip_page.reload()
            logger.info("当前每日签到状态："+await vip_page.$eval('.sign-in > .name', element => element.innerText))
        }else {
            logger.info("当前每日签到状态："+sign_in_status)
        }
        await vip_page.screenshot({path: "screenshots/jd_daily_checkin_"+getFormatedTime()+".png"});
        await vip_page.close()
    }catch (e) {
        logger.error(e)
    }
}

//店铺签到
async function shop_checkin(browser){
    logger.info("开始京东店铺签到...")
    try {
        const earnBean_url = 'https://bean.jd.com/myJingBean/list#earnBean';
        const earnBean_page = await browser.newPage();
        await earnBean_page.setViewport(viewPort)
        await earnBean_page.setCookie(...cookies);
        await earnBean_page.goto(earnBean_url);
        var bean_number = await earnBean_page.$eval('.bi-number',e => e.innerText)
        logger.info(getFormatedTime()+" 当前我的金豆数目："+bean_number)

        const shop_elements = await earnBean_page.$$('.shop-bd > .bean-shop-list > li')
        //logger.info(shop_elements.length)
        for (let i = 0; i <shop_elements.length ; i++) {
            const shop_element = shop_elements[i];
            const shop_name = await shop_element.$eval('.s-name > a',e => e.innerText)
            const shop_bean = await shop_element.$eval('.s-bean ',e => e.innerText)
            const shop_url = await shop_element.$eval('a ',e => e.href)
            //logger.info(shop_name+" "+shop_bean+" "+shop_href)
            logger.info(shop_name+", "+shop_bean)
            var shop_page = await browser.newPage()
            await shop_page.setViewport(viewPort)
            await shop_page.setCookie(...cookies)
            await shop_page.goto(shop_url)
            try {
                //点击领取并关注
                await shop_page.click('.J_drawGift.d-btn')
            }catch (e) {

            }

            const shop_checkin_status = await shop_page.$eval( ' .jSign > a ',e => e.innerText);
            //logger.info(checkin_status)
            if(shop_checkin_status == "签到" ){
                logger.info("开始签到 "+shop_name)
                await shop_page.click(' .jSign ')
                await shop_page.waitFor(3000)
                await shop_page.reload()
                logger.info(shop_name+" 签到状态："+await shop_page.$eval( ' .jSign > a ',e => e.innerText))
            }else {
                logger.info(shop_name+" 签到状态："+shop_checkin_status)
            }

            await shop_page.close()
        }

        await earnBean_page.reload()
        bean_number = await earnBean_page.$eval('.bi-number',e => e.innerText)
        logger.info(getFormatedTime()+" 当前我的金豆数目："+bean_number)
        earnBean_page.close()
    }catch (e) {
        logger.error(e)
    }
}

(async() => {
    var browser = null;
    logger.info("开始启动京东签到脚本...")
    try {
        browser = await puppeteer.launch({headless:false});
        //browser = await puppeteer.launch({executablePath: '/usr/bin/chromium'});
    }catch (e) {
        logger.error("launch browser 失败："+e)
        await browser.close();
        return -1;
    }

    await daily_checkin(browser)
    await shop_checkin(browser)
    await browser.close();

})();
