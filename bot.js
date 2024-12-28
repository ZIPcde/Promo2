const puppeteer = require('puppeteer');
const fs = require('fs');

// Загружаем учетные записи из файла
const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));

// Функция для задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для сохранения обновленных учетных записей в файл
function saveAccounts() {
    fs.writeFileSync('accounts.json', JSON.stringify(accounts, null, 4), 'utf8');
}

// Функция проверки времени последнего подарка
function isEligibleForGift(lastGiftTime) {
    if (!lastGiftTime) return true;
    const now = Date.now();
    const lastGiftTimestamp = new Date(lastGiftTime).getTime();
    return (now - lastGiftTimestamp) >= 6 * 60 * 60 * 1000; // 6 часов
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

            // Пропускаем запись, если с момента последнего подарка прошло менее 6 часов
            if (!isEligibleForGift(account.lastGiftTime)) {
                console.log(`Пропуск аккаунта ${account.username}, прошло менее 6 часов.`);
                continue;
            }

            try {
                // Открытие страницы входа
                console.log('Переход на страницу входа...');
                await Promise.race([
                    page.goto('https://fw-rebirth.com/register_or_login#login', { waitUntil: 'load' }),
                    delay(20000), // Максимум 20 секунд
                ]);

                console.log('Попытка ввода данных в форму...');
                await page.type('input[name="username"]', account.username);
                await page.type('input[name="password"]', account.password);

                // Отправка формы
                console.log('Отправка данных для входа...');
                await page.keyboard.press('Enter');

                console.log('Ожидание загрузки страницы или переход...');
                await Promise.race([
                    page.waitForNavigation({ waitUntil: 'load', timeout: 7000 }), // Ждем максимум 7 секунд
                    delay(7000)
                ]);

                console.log(`Переход на страницу: https://fw-rebirth.com/xmas.php`);
                await page.goto('https://fw-rebirth.com/xmas.php', { waitUntil: 'load' });

                // Проверка наличия таймера
                try {
                    await page.waitForSelector('.timer', { timeout: 10000 });
                    console.log('Таймер найден, разлогиниваемся...');
                    await page.goto('https://fw-rebirth.com/lk_scripts/logout', { waitUntil: 'load' });
                } catch {
                    console.log('Таймер не найден, выбираем подарок...');
                    const prizeBox = await page.$('.prize.choose');
                    if (prizeBox) {
                        await prizeBox.click();
                        await delay(2000); // Задержка в 2 секунды после выбора

                        // Проверка появления таймера
                        try {
                            await page.waitForSelector('.timer', { timeout: 10000 });
                            console.log('Таймер появился. Обновляем время последнего подарка.');
                            account.lastGiftTime = new Date().toISOString();
                            saveAccounts();
                        } catch {
                            console.log('Таймер не появился.');
                        }
                    }
                }
            } catch (error) {
                console.error(`Ошибка при обработке аккаунта ${account.username}: ${error.message}`);
            }

            // Разлогиниваемся после обработки аккаунта
            console.log('Переход на страницу выхода...');
            await Promise.race([
                page.goto('https://fw-rebirth.com/lk_scripts/logout', { waitUntil: 'load' }),
                delay(20000), // Максимум 20 секунд
            ]);

            console.log('Переход к следующему аккаунту...');
        }

        console.log('Все учетные записи обработаны. Повторяем цикл...');
    }

    // await browser.close(); // Браузер оставляем открытым для проверки
})();
