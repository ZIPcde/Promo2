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
                console.log('Переход на страницу входа...');
                await Promise.race([
                    page.goto('https://fw-rebirth.com/register_or_login#login', { waitUntil: 'load' }),
                    delay(20000), // Максимум 20 секунд
                ]);
                await delay(200);

                console.log('Попытка ввода данных в форму...');
                await page.type('input[name="username"]', account.username);
                await delay(200);
                await page.type('input[name="password"]', account.password);
                await delay(200);

                console.log('Отправка данных для входа...');
                await page.keyboard.press('Enter');
                await delay(200);

                console.log('Переход на страницу: https://fw-rebirth.com/xmas.php');
                await page.goto('https://fw-rebirth.com/xmas.php', { waitUntil: 'load' });
                await delay(200);

                // Проверка наличия таймера
                try {
                    await page.waitForSelector('.time-left', { timeout: 10000 });
                    console.log('Таймер найден.');

                    // Извлечение значений таймера
                    const timer = await page.evaluate(() => {
                        const timeElements = document.querySelectorAll('.time li');
                        if (timeElements.length === 3) {
                            const [hours, minutes, seconds] = Array.from(timeElements).map(el => parseInt(el.textContent.trim(), 10));
                            return { hours, minutes, seconds };
                        }
                        return null;
                    });

                    if (timer) {
                        console.log(`Оставшееся время: ${timer.hours}ч ${timer.minutes}м ${timer.seconds}с`);

                        // Вычисление времени последнего подарка
                        const now = new Date();
                        now.setHours(now.getHours() - timer.hours);
                        now.setMinutes(now.getMinutes() - timer.minutes);
                        now.setSeconds(now.getSeconds() - timer.seconds);

                        account.lastGiftTime = now.toISOString();
                        console.log(`Обновленное время последнего подарка: ${account.lastGiftTime}`);
                        saveAccounts();
                    }

                    console.log('Разлогиниваемся...');
                    await page.goto('https://fw-rebirth.com/lk_scripts/logout', { waitUntil: 'load' });
                    await delay(200);
                    continue; // Пропускаем текущий аккаунт
                } catch {
                    console.log('Таймер не найден, выбираем подарок...');
                    const prizeBox = await page.$('.prize.choose');
                    if (prizeBox) {
                        await prizeBox.click();
                        await delay(2000); // Задержка в 2 секунды после выбора

                        try {
                            const prizeElement = await page.waitForSelector('.prize.win', { timeout: 10000 });
                            const prizeTitle = await prizeElement.evaluate(el => el.getAttribute('title'));

                            if (prizeTitle) {
                                console.log(`Найден подарок: ${prizeTitle}`);
                                if (!account.gifts) {
                                    account.gifts = [];
                                }
                                account.gifts.push(prizeTitle);
                                console.log('Подарок добавлен в список аккаунта.');
                            }

                            console.log('Обновляем время последнего подарка.');
                            account.lastGiftTime = new Date().toISOString();
                            saveAccounts();
                        } catch {
                            console.log('Таймер или подарок не обнаружены.');
                        }
                    }
                }
            } catch (error) {
                console.error(`Ошибка при обработке аккаунта ${account.username}: ${error.message}`);
            }

            console.log('Переход на страницу выхода...');
            await Promise.race([
                page.goto('https://fw-rebirth.com/lk_scripts/logout', { waitUntil: 'load' }),
                delay(20000),
            ]);
            await delay(200);

            console.log('Переход к следующему аккаунту...');
        }

        console.log('Все учетные записи обработаны. Повторяем цикл...');
    }

    // await browser.close(); // Браузер оставляем открытым для проверки
})();
