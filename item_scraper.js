const puppeteer = require('puppeteer');

(async () => {
    const itemdex = {};
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    for (let list_link of ['https://pokemondb.net/item/all', 'https://pokemondb.net/item/type/key']) {
        console.log('Scraping ' + list_link);
        await page.goto(list_link);

        const item_queue = await page.evaluate((is_key_item) => {
            const trs = Array.from(document.querySelectorAll('tr')).slice(1);
            return trs.map(tr => ({
                name: tr.children[0].children[1].innerText,
                category: is_key_item ? 'key' : tr.children[1].innerText.replace(' items', '').replace('Hold', 'Held').toLowerCase(),
                link: tr.children[0].children[1].href
            }));
        }, list_link === 'https://pokemondb.net/item/type/key');

        for(let item of item_queue) {
            console.log('Attempting to scrape ' + item.name);
            await page.goto(item.link, {waitUntil: 'networkidle2', timeout: 0});
            const item_data = await page.evaluate((category) => {
                if (document.querySelector('p').innerText.endsWith('details may be incomplete.'))
                    return null;
                const item_data = {};
                item_data.effects = '';
                item_data.category = category;
                let effects = document.querySelector('h2').nextElementSibling;
                while (effects !== null && effects.tagName !== 'H3' && effects.tagName !== 'H2') {
                    if (effects.tagName === 'P' || effects.tagName === 'PRE') {
                        if (item_data.effects === '')
                            item_data.effects = effects.innerText.trim();
                        else
                            item_data.effects += '\n' + effects.innerText.trim();
                    } else if (effects.tagName === 'UL') {
                        item_data.effects += '\n';
                        for (let li of effects.querySelectorAll('li')) {
                            item_data.effects += '\n -' + li.innerText.trim();
                        }
                        item_data.effects += '\n';
                    } else if (effects.tagName === 'TABLE') {
                        table_info = '\n';
                        for (let row of effects.querySelectorAll('tr')) {
                            let table_row = '';
                            for (let cell of row.children) {
                                if (table_row === '') {
                                    table_row = cell.innerText.trim();
                                } else {
                                    table_row += ' :: ' + cell.innerText.trim();
                                }
                            }
                            table_info += table_row + '\n';
                        }
                    }
                    effects = effects.nextElementSibling;
                }
                item_data.description = {};
                const descr_table = document.querySelector('#item-descr');
                if (descr_table !== null) {
                    const data_table_rows = Array.from(descr_table.nextElementSibling.querySelectorAll('tr'));
                    for (let row of data_table_rows) {
                        const description = row.children[1].innerText.trim();
                        for (let game of row.querySelectorAll('.igame')) {
                            let title = game.innerText.trim();
                            title = title.replace('O.R', 'Omega R').replace('A.S', 'Alpha S');
                            title = title.replace('L.G.', 'Let\'s Go');
                            title = title.replace('B.D', 'Brilliant D').replace('S.P', 'Shining P');
                            if (description !== '- - -')
                                item_data.description[title] = description;
                        }
                    }
                }
                if (item_data.effects === '') {
                    const game = Object.keys(item_data.description)[0];
                    item_data.effects = item_data.description[game];
                }
                return item_data;
            }, item.category);
            if (item_data !== null) {
                itemdex[item.name] = item_data;
                console.log(item_data);
            } else {
                console.log('No data found for ' + item.name);
            }
        }
    }

    var fs = require('fs').promises;
    await fs.writeFile('itemdex.json', JSON.stringify(itemdex, space=4));

    await browser.close();
})();