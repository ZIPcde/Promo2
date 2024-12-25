const puppeteer = require('puppeteer');
const fs = require('fs');

// Загружаем учетные записи из файла
const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));

// Функция для задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--start-maximized']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    while (true) { // Бесконечный цикл
        for (let account of accounts) {
            console.log(`Переход к аккаунту: ${account.username}`);

            try {
                // Открытие страницы входа
                await page.goto('https://fw-rebirth.com/register_or_login#login');

                // Задержка перед вводом данных
                console.log('Ожидание 20 секунд...');
                await delay(20000);

                // Ввод логина и пароля
                await page.type('input[name="username"]', account.username);
                await page.type('input[name="password"]', account.password);

                // Отправка формы
                await page.keyboard.press('Enter');

                // Простая задержка вместо ожидания полной загрузки
                await delay(15000); // 15 секунд ожидания

                console.log(`Переход на страницу: https://fw-rebirth.com/xmas.php`);
                await page.goto('https://fw-rebirth.com/xmas.php');

                // Проверка наличия таймера
                try {
                    await page.waitForSelector('.timer', { timeout: 10000 });
                    console.log('Таймер найден, разлогиниваемся...');
                    await page.goto('https://fw-rebirth.com/lk_scripts/logout');
                } catch {
                    console.log('Таймер не найден, выбираем подарок...');
                    const prizeBox = await page.$('.prize.choose');
                    if (prizeBox) {
                        await prizeBox.click();
                        await delay(2000); // Задержка в 2 секунды после выбора
                    }
                }
            } catch (error) {
                console.error(`Ошибка при обработке аккаунта ${account.username}: ${error.message}`);
                console.log('Переход на страницу выхода...');
                await page.goto('https://fw-rebirth.com/lk_scripts/logout');
            }

            // Задержка перед переходом к следующему аккаунту
            await delay(5000);
        }

        console.log('Все учетные записи обработаны. Повторяем цикл...');
    }

    // await browser.close(); // Браузер оставляем открытым для проверки
})();
