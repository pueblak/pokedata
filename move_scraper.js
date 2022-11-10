const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    var fs = require('fs').promises;
    let movedex = require('./movedex_links.json');

    for (let move of Object.keys(movedex)) {
        console.log('Attempting to scrape ' + movedex[move]);
        await page.goto(movedex[move], {waitUntil: 'networkidle2', timeout: 0});
        const move_data = await page.evaluate(() => {
            const move_data = {};
            const data_table = document.querySelector('.vitals-table');
            if (data_table !== null) {
                const data_table_rows = Array.from(data_table.querySelectorAll('tr'));
                for (let row of data_table_rows) {
                    if (row.children[0].innerText.startsWith('Type')) {
                        move_data.type = row.children[1].innerText.toUpperCase();
                    } else if (row.children[0].innerText.startsWith('Category')) {
                        move_data.category = row.children[1].innerText.trim();
                    } else if (row.children[0].innerText.startsWith('Power')) {
                        move_data.power = row.children[1].innerText;
                        if (move_data.power === '—')
                            move_data.power = 0;
                        else
                            move_data.power = parseInt(move_data.power);
                    } else if (row.children[0].innerText.startsWith('Accuracy')) {
                        move_data.accuracy = row.children[1].innerText;
                        if (move_data.accuracy === '—')
                            move_data.accuracy = 100.0;
                        else if (move_data.accuracy === '∞')
                            move_data.accuracy = Infinity;
                        else
                            move_data.accuracy = parseFloat(move_data.accuracy);
                    } else if (row.children[0].innerText.startsWith('PP')) {
                        move_data.pp = parseInt(row.children[1].innerText.split(' ')[0]);
                        move_data.max_pp = parseInt(row.children[1].innerText.split('max. ')[1].split(')')[0]);
                    } else if (row.children[0].innerText.startsWith('Priority')) {
                        move_data.priority = parseInt(row.children[1].innerText);
                    } else if (row.children[0].innerText.contains('contact')) {
                        move_data.contact = row.children[1].innerText === 'Yes';
                    } else if (row.children[0].innerText.startsWith('Introduced')) {
                        move_data.generation = parseInt(row.children[1].innerText.split(' ')[1]);
                    }
                }
                if (move_data.priority === undefined)
                    move_data.priority = 0;
                let table_info = null;
                let effects = document.querySelector('#move-effects').nextElementSibling;
                while (effects !== null && effects.tagName !== 'H3') {
                    if (effects.tagName === 'P' || effects.tagName === 'PRE') {
                        if (move_data.effects === undefined)
                            move_data.effects = effects.innerText.trim();
                        else
                            move_data.effects += '\n' + effects.innerText.trim();
                    } else if (effects.tagName === 'UL') {
                        move_data.effects += '\n';
                        for (let li of effects.querySelectorAll('li')) {
                            move_data.effects += '\n -' + li.innerText.trim();
                        }
                        move_data.effects += '\n';
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
                if (table_info !== null) {
                    move_data.effects += table_info;
                }
                move_data.target = document.querySelector('.mt-descr').innerText;
                if (move_data.target == '')
                    move_data.target = 'Currently unknown.';
                move_data.description = {};
                try {
                    const descr_rows = Array.from(document.querySelector('#move-descr').nextElementSibling.querySelectorAll('tr'));
                    for (let row of descr_rows) {
                        const descr = row.children[1].innerText;
                        for (let game of Array.from(row.querySelectorAll('.igame'))) {
                            let title = game.innerText;
                            title = title.replace('O.R', 'Omega R').replace('A.S', 'Alpha S');
                            title = title.replace('L.G.', 'Let\'s Go');
                            title = title.replace('B.D', 'Brilliant D').replace('S.P', 'Shining P');
                            move_data.description[title] = descr;
                        }
                    }
                } catch (e) {
                    move_data.description['Legends: Arceus'] = move_data.effects;
                }
            }
            return move_data;
        });
        movedex[move] = move_data;
        console.log(move, movedex[move]);
    }

    await fs.writeFile('movedex.json', JSON.stringify(movedex, space=4));

    await browser.close();
})();
