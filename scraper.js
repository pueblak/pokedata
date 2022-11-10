const puppeteer = require('puppeteer');

const LATEST_GENERATION = 8;
function get_generation(national_no) {
    if (national_no < 1)
        return -1;
    else if (national_no <= 151)
        return 1;
    else if (national_no <= 251)
        return 2;
    else if (national_no <= 386)
        return 3;
    else if (national_no <= 493)
        return 4;
    else if (national_no <= 649)
        return 5;
    else if (national_no <= 721)
        return 6;
    else if (national_no <= 809)
        return 7;
    else if (national_no <= 905)
        return 8;
    else
        return -1;
}


(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://pokemondb.net/pokedex/all');

    const pokemon = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr')).slice(1);
        return trs.map(tr => ({
            number: parseInt(tr.children[0].children[1].innerText),
            name: tr.children[1].children[0].innerText,
            link: tr.children[1].children[0].href
        }));
    });
    const pokedex = {};
    const movedex = {};
    const lookup_by_location = {};
    const lookup_by_number = { 'National': {} };
    for (let entry_obj of pokemon) {
        if (entry_obj.name in pokedex)
            continue;
        pokedex[entry_obj.name] = {};
        // console.log(entry_obj.name);

        await page.goto(entry_obj.link, { waitUntil: 'networkidle2', timeout: 0 });
        
        const number = await page.evaluate(() => {
            const main = document.querySelector('#main');
            const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));

            return parseInt(pokedex_data[0].children[1].innerText);
        });
        // console.log(number);

        const generation = get_generation(number);

        const num_forms = await page.evaluate(() => {
            return document.querySelector('.sv-tabs-tab-list').querySelectorAll('.sv-tabs-tab').length;
        });
        // console.log(num_forms);

        const form_list = [];
        for (let i = 0; i < num_forms; i++) {
            const form_name = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const form_name = main.querySelector('.sv-tabs-tab-list').children[i].innerText;
                return form_name;
            }, i);
            form_list.push(form_name);
            // console.log(form_name);

            if (form_name !== entry_obj.name)
                pokedex[entry_obj.name][form_name] = {};

            const types = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
                const types = Array.from(pokedex_data[22 * i + 1].children[1].children).map(a => a.innerText.toUpperCase());
                const type1 = types[0];
                var type2 = null;
                if (types.length === 2)
                    type2 = types[1];
                return [type1, type2];
            }, i);
            // console.log(types);

            const height = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
                const height = pokedex_data[22 * i + 3].children[1].innerText.trim();
                if (height === '—')
                    return null;
                const height_m = height.split(' ')[0];
                const height_ft = height.split('(')[1].slice(0, -1).replace("′", 'ft. ').replace("″", 'in.').replace(' 0', ' ').replace('\xa0', ' ');
                const height_val = parseFloat(height_m);
                return {
                    value: height_val,
                    m: height_m + ' m.',
                    ft: height_ft
                };
            }, i);
            // console.log(height);

            const weight = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
                const weight = pokedex_data[22 * i + 4].children[1].innerText.trim();
                if (weight === '—')
                    return null;
                const weight_kg = weight.split(' ')[0];
                const weight_lbs = weight.split('(')[1].slice(0, -1).replace('\xa0', ' ');
                const weight_val = parseFloat(weight_kg);
                return {
                    value: weight_val,
                    kg: weight_kg,
                    lbs: weight_lbs
                };
            }, i);
            // console.log(weight);

            const abilities = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
                const abilities = { primary: null, secondary: null, hidden: null };
                for (let elem of pokedex_data[22 * i + 5].children[1].querySelectorAll('a')) {
                    const ability = {
                        name: elem.innerText,
                        link: elem.href,
                        info: elem.getAttribute('title')
                    };
                    if (elem.outerHTML.includes('hidden ability'))
                        abilities.hidden = ability;
                    else if (abilities.primary === null)
                        abilities.primary = ability;
                    else
                        abilities.secondary = ability;
                }
                return abilities;
            }, i);
            // console.log(abilities);

            let base_exp = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr td'));
                return pokedex_data[22 * i + 10].innerText.trim();
            }, i);
            base_exp = parseInt(base_exp);
            if (base_exp == NaN)
                base_exp = null;
            // console.log(base_exp);

            const stats = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                try {
                    const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
                    const hp = {
                        base: parseInt(pokedex_data[22 * i + 15].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 15].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 15].children[4].innerText)
                    };
                    const attack = {
                        base: parseInt(pokedex_data[22 * i + 16].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 16].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 16].children[4].innerText)
                    };
                    const defense = {
                        base: parseInt(pokedex_data[22 * i + 17].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 17].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 17].children[4].innerText)
                    };
                    const spAttack = {
                        base: parseInt(pokedex_data[22 * i + 18].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 18].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 18].children[4].innerText)
                    };
                    const spDefense = {
                        base: parseInt(pokedex_data[22 * i + 19].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 19].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 19].children[4].innerText)
                    };
                    const speed = {
                        base: parseInt(pokedex_data[22 * i + 20].children[1].innerText),
                        min: parseInt(pokedex_data[22 * i + 20].children[3].innerText),
                        max: parseInt(pokedex_data[22 * i + 20].children[4].innerText)
                    };
                    const base_total = hp.base + attack.base + defense.base + spAttack.base + spDefense.base + speed.base;
                    return {
                        hp: hp,
                        attack: attack,
                        defense: defense,
                        spAttack: spAttack,
                        spDefense: spDefense,
                        speed: speed,
                        base_total: base_total
                    };
                } catch (e) {
                    return null;
                }
            }, i);
            // console.log(stats);

            const type_matchups = await page.evaluate((i) => {
                const main = document.querySelector('#main');
                const all_tabs = Array.from(main.querySelector('.sv-tabs-panel-list').children);
                const ability_tabs = Array.from(all_tabs[i].querySelectorAll('.sv-tabs-tab'));
                const type_matchups = {};
                for (let j = 0; j < ability_tabs.length; j++) {
                    const ability_matchups = {
                        normal: 1,
                        fire: 1,
                        water: 1,
                        electric: 1,
                        grass: 1,
                        ice: 1,
                        fighting: 1,
                        poison: 1,
                        ground: 1,
                        flying: 1,
                        psychic: 1,
                        bug: 1,
                        rock: 1,
                        ghost: 1,
                        dragon: 1,
                        dark: 1,
                        steel: 1,
                        fairy: 1
                    };
                    const type_matchups_table = Array.from(all_tabs[i].querySelectorAll('.type-table tr td')).slice(18 * j, 18 * j + 18);
                    for (let matchup of type_matchups_table) {
                        const type = matchup.getAttribute('title').split(' → ')[0].toLowerCase();
                        const value = matchup.innerText;
                        if (value === '¼')
                            ability_matchups[type] = 0.25;
                        else if (value === '½')
                            ability_matchups[type] = 0.5;
                        else if (value === '1½')
                            ability_matchups[type] = 1.5;
                        else if (value === '2')
                            ability_matchups[type] = 2;
                        else if (value === '4')
                            ability_matchups[type] = 4;
                        else if (value === '0')
                            ability_matchups[type] = 0;
                    }
                    if (ability_tabs.length == 1)
                        type_matchups.all = JSON.parse(JSON.stringify(ability_matchups));
                    else {
                        const ability = Array.from(all_tabs[i].querySelectorAll('.sv-tabs-tab')).at(j).innerText.trim();
                        type_matchups[ability] = JSON.parse(JSON.stringify(ability_matchups));
                    }
                }
                return type_matchups;
            }, i);
            // console.log(type_matchups);

            const info = {
                type1: types[0],
                type2: types[1],
                height: height,
                weight: weight,
                abilities: abilities,
                base_exp: base_exp,
                stats: stats,
                //type_matchups: type_matchups
            };
            if (form_name !== entry_obj.name) {
                pokedex[entry_obj.name][form_name] = info;
            } else {
                for (let key of Object.keys(info)) {
                    pokedex[entry_obj.name][key] = info[key];
                }
            }
        }

        const species = await page.evaluate(() => {
            const main = document.querySelector('#main');
            const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
            return pokedex_data[2].children[1].innerText;
        });
        // console.log(species);

        const local_no = await page.evaluate(() => {
            const main = document.querySelector('#main');
            const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
            const local_no = {};
            for (let text of pokedex_data[6].children[1].innerHTML.split('<br>')) {
                if (text === '')
                    continue;
                const games = text.split('(')[1].slice(0, -9).split(' — ')[0];
                const no = parseInt(text.split('(')[0].trim());
                for (let game of games.split('/')) {
                    local_no[game] = no;
                }
            }
            return local_no;
        });
        // console.log(local_no);

        for (let game of Object.keys(local_no)) {
            if (lookup_by_number[game] === undefined)
                lookup_by_number[game] = {};
            lookup_by_number[game][local_no[game]] = entry_obj.name;
        }

        const training_data = await page.evaluate(() => {
            const main = document.querySelector('#main');
            const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
            const ev_yield = pokedex_data[7].children[1].innerText.trim().split(', ');
            const catch_rate = parseInt(pokedex_data[8].children[1].innerText.split('(')[0].trim());
            const base_friendship = parseInt(pokedex_data[9].children[1].innerText.split('(')[0].trim());
            const growth_rate = pokedex_data[11].children[1].innerText.trim();
            return {
                ev_yield: ev_yield[0] === '—' ? [] : ev_yield,
                catch_rate: catch_rate,
                base_friendship: base_friendship,
                growth_rate: growth_rate === '—' ? null : growth_rate
            };
        });
        // console.log(training_data);

        const breeding_data = await page.evaluate(() => {
            const main = document.querySelector('#main');
            const pokedex_data = Array.from(main.querySelectorAll('.vitals-table tr'));
            const egg_groups = pokedex_data[12].children[1].innerText.split(',').map(x => x.trim());
            const gender_ratio = pokedex_data[13].children[1].innerText.split(',').map(x => x.split('%')[0].trim());
            const genderless = gender_ratio[0] === 'Genderless' || gender_ratio[0] === '—';
            const egg_cycles = parseInt(pokedex_data[14].children[1].innerText.split('(')[0].trim());
            return {
                egg_groups: egg_groups[0] === '—' ? [] : egg_groups,
                gender_ratio: {
                    male: genderless ? 0 : gender_ratio[0] / 100,
                    female: genderless ? 0 : gender_ratio[1] / 100,
                    neither: genderless ? 1 : 0
                },
                egg_cycles: egg_cycles
            };
        });
        // console.log(breeding_data);

        const evo_tree_lookup = {
            default: [
                { from: 0, to: 1, method: 0 },  // 0 → 1 (→ 2)
                { from: 1, to: 2, method: 1 }   //
            ],                                  //
            parallel: [                         //
                { from: 0, to: 1, method: 0 },  // 0 → 1
                { from: 2, to: 3, method: 1 }   // 2 → 3
            ],                                  //
            split: [                            //  ↱ 1
                { from: 0, to: 1, method: 0 },  // 0
                { from: 0, to: 2, method: 1 }   //  ↳ 2
            ],                                  //
            triple_split: [                     //    
                { from: 0, to: 1, method: 0 },  //  ↱ 1
                { from: 0, to: 2, method: 1 },  // 0 → 2
                { from: 0, to: 3, method: 2 }   //  ↳ 3
            ],                                  //
            split_second: [                     //
                { from: 0, to: 1, method: 0 },  //      ↱ 2
                { from: 1, to: 2, method: 1 },  // 0 → 1
                { from: 1, to: 3, method: 2 }   //      ↳ 3
            ],                                  //
            split_parallel: [                   //
                { from: 0, to: 1, method: 0 },  //  ↱ 1 → 2
                { from: 1, to: 2, method: 1 },  // 0
                { from: 0, to: 3, method: 2 },  //  ↳ 3 → 4
                { from: 3, to: 4, method: 3 }   //
            ],                                  //
            Eevee: [                            //
                { from: 0, to: 1, method: 0 },  //  ↱ 1
                { from: 0, to: 2, method: 1 },  //  ↱ 2
                { from: 0, to: 3, method: 2 },  //  ↱ 3
                { from: 0, to: 5, method: 3 },  // 0 → 5
                { from: 0, to: 6, method: 4 },  //  ↳ 6
                { from: 0, to: 8, method: 5 },  //  ↳ 8
                { from: 0, to: 9, method: 6 },  //  ↳ 9
                { from: 0, to: 11, method: 7 }  //  ↳ 11
            ],                                  //
            Slowpoke: [                         //  ↱ 1
                { from: 0, to: 1, method: 0 },  // 0
                { from: 0, to: 2, method: 1 },  //  ↳ 2
                { from: 3, to: 4, method: 2 },  //  ↱ 4
                { from: 3, to: 5, method: 3 }   // 3
            ],                                  //  ↳ 5
            Meowth: [                           //
                { from: 0, to: 1, method: 0 },  // 0 → 1
                { from: 2, to: 3, method: 1 },  // 2 → 3
                { from: 4, to: 5, method: 2 }   // 4 → 5
            ],                                  //
            Burmy: [                            //
                { from: 0, to: 1, method: 0 },  // 0 → 1
                { from: 2, to: 3, method: 1 },  // 2 → 3
                { from: 4, to: 5, method: 2 },  // 4 → 5
                { from: 6, to: 7, method: 3 }   // 6 → 7
            ],                                  //
            'Mime Jr.': [                       //
                { from: 0, to: 1, method: 0 },  //  ↱ 1
                { from: 0, to: 2, method: 1 },  // 0
                { from: 2, to: 3, method: 2 }   //  ↳ 2 → 3
            ],                                  //
            Geodude: [                          //
                { from: 0, to: 1, method: 0 },  //
                { from: 1, to: 2, method: 1 },  // 0 → 1 → 2
                { from: 3, to: 4, method: 2 },  // 3 → 4 → 5
                { from: 4, to: 5, method: 3 }   //
            ],                                  //
            Zigzagoon: [                        //
                { from: 0, to: 1, method: 0 },  // 0 → 1
                { from: 2, to: 3, method: 1 },  // 2 → 3 → 4
                { from: 3, to: 4, method: 2 }   //
            ]                                   //
        };

        const evolution = await page.evaluate((name, evo_tree_lookup) => {
            let evolution = {};
            evolution[name] = null;
            if (Array.from(document.querySelectorAll('.infocard-list-evo')).length === 0)
                return evolution;
            evolution[name] = [];
            
            function name_tree_lookup(name) {
                if (['Eevee', 'Slowpoke', 'Meowth', 'Mime Jr.', 'Geodude', 'Zigzagoon'].includes(name))
                    return evo_tree_lookup[name];
                else if (['Wurmple', 'Goomy'].includes(name))
                    return evo_tree_lookup.split_parallel;
                else if (['Tyrogue', 'Rockruff'].includes(name))
                    return evo_tree_lookup.triple_split;
                else if (['Exeggcute', 'Cubone', 'Koffing', 'Scyther', 'Snorunt', 'Clamperl', 'Espurr', 'Petlil',
                        'Rufflet', 'Goomy', 'Bermite', 'Applin', 'Toxel', 'Kubfu', 'Basculin'].includes(name))
                    return evo_tree_lookup.split;
                else if (['Oddish', 'Poliwag', 'Cyndaquil', 'Pichu', 'Ralts', 'Oshawott', 'Rowlet', 'Cosmog'].includes(name))
                    return evo_tree_lookup.split_second;
                else if (['Rattata', 'Sandshrew', 'Vulpix', 'Diglett', 'Growlithe', 'Ponyta', "Farfetch'd",
                        'Grimer', 'Voltorb', 'Sneasel', 'Darumaka', 'Yamask', 'Zorua'].includes(name))
                    return evo_tree_lookup.parallel;
                return evo_tree_lookup.default;
            }

            let subtree = document.querySelector('#dex-evolution').nextElementSibling.nextElementSibling;
            while (subtree.className === 'infocard-list-evo') {
                // logic for grabbing the evolution data
                const evo_text = Array.from(subtree.querySelectorAll('.infocard-lg-data')).map(x => x.innerText.split('\n'));
                const evo_names = Array.from(subtree.querySelectorAll('.ent-name')).map(x => x.innerText);
                const evo_methods = Array.from(subtree.querySelectorAll('.infocard-arrow')).map(x => x.innerText.slice(1, -1));
                const evo_tree = name_tree_lookup(evo_names[0]);
                // logic for building the evolution tree based on a predefined structure
                if (evo_names[0] === 'Nincada') {
                    evolution[name].push({
                        from_name: evo_names[0],
                        from_form: null,
                        to_name: evo_names[1],
                        to_form: null,
                        method: evo_methods[0]
                    });
                    evolution[name].push({
                        from_name: evo_names[0],
                        from_form: null,
                        to_name: [evo_names[2], evo_names[3]],
                        to_form: [null, null],
                        method: evo_methods[1]
                    });
                } else {
                    for (let i = 0; i < Math.min(evo_tree.length, evo_methods.length); i++) {
                        const idx_from = evo_tree[i].from;
                        const idx_to = evo_tree[i].to;
                        const from_name = evo_names[idx_from];
                        const to_name = evo_names[idx_to];
                        const from_form = evo_text[idx_from].length === 4 ? evo_text[idx_from][2].trim() : null;
                        const to_form = evo_text[idx_to].length === 4 ? evo_text[idx_to][2].trim() : null;
                        let form = from_name === name ? from_form : to_form;
                        if (form === null)
                            form = name;
                        if (evolution[form] === undefined)
                            evolution[form] = [];
                        if (from_name === name || to_name === name) {
                            evolution[form].push({
                                from_name: from_name,
                                from_form: from_form,
                                to_name: to_name,
                                to_form: to_form,
                                method: evo_methods[evo_tree[i].method]
                            });
                        }
                    }
                }
                subtree = subtree.nextElementSibling;
            }
            return evolution;
        }, entry_obj.name, evo_tree_lookup);
        for (const form in evolution) {
            if (form !== entry_obj.name) {
                if (pokedex[entry_obj.name][form] === undefined)
                    pokedex[entry_obj.name][form] = {};
                pokedex[entry_obj.name][form].evolution = evolution[form];
            } else {
                pokedex[entry_obj.name].evolution = evolution[form];
            }
        }
        // console.log(evolution);

        const pokedex_entry = await page.evaluate((form_list) => {
            const pokedex_entry = {};
            pokedex_entry[form_list[0]] = null;
            let num_forms = document.querySelector('.sv-tabs-tab-list').querySelectorAll('.sv-tabs-tab').length;
            for (let f = 0; f < num_forms; f++) {
                try {
                    pokedex_entry[form_list[f]] = {};
                    let table = document.querySelectorAll('.vitals-table')[4 * num_forms + f];
                    for (let entry of Array.from(table.querySelectorAll('tr'))) {
                        const games = entry.children[0].innerHTML.split('<br>').map(x => x.split('>')[1].split('<')[0]);
                        const text = entry.children[1].innerText;
                        for (let game of games) {
                            pokedex_entry[form_list[f]][game] = text;
                        }
                    }
                } catch (e) {
                    pokedex_entry[form_list[f]] = null;
                }
            }
            return pokedex_entry;
        }, form_list);
        // console.log(pokedex_entry);

        for (let form of form_list) {
            if (form !== entry_obj.name) {
                pokedex[entry_obj.name][form].pokedex_entry = pokedex_entry[form];
            }
        }

        const locations = await page.evaluate(() => {
            const locations = {};
            const tables = document.querySelectorAll('.vitals-table');
            let table = tables[tables.length - 1];
            if (table.parentElement.previousElementSibling.innerText === 'Other languages')
                table = tables[tables.length - 2];
            for (let entry of Array.from(table.querySelectorAll('tr'))) {
                const games = entry.children[0].innerHTML.split('<br>').map(x => x.split('>')[1].split('<')[0]);
                let areas = entry.children[1].innerText.split(', ').map(x => x.trim().replace('Route ', ''));
                if (areas[0] === 'Not available in this game' || areas[0] === 'Trade/migrate from another game')
                    areas = [];
                for (let game of games) {
                    locations[game] = areas;
                }
            }
            return locations;
        });
        // console.log(locations);

        for (let game of Object.keys(locations)) {
            if (locations[game].length > 0) {
                for (let location of locations[game]) {
                    if (lookup_by_location[location] === undefined)
                        lookup_by_location[location] = [];
                    lookup_by_location[location].push(entry_obj.name);
                }
            }
        }

        const moves = {};
        const moves_page = await browser.newPage();
        let name = entry_obj.name.toLowerCase();
        if (name.startsWith('flab'))
            name = 'flabebe';
        name = name.replace('♀', '-f').replace('♂', '-m').replace('é', 'e');
        name = name.replace(' ', '-').replace('\'', '').replace('.', '').replace(':', '');
        for (let gen = generation; gen <= LATEST_GENERATION; gen++) {
            const page_link = `https://pokemondb.net/pokedex/${name}/moves/${gen}`;
            await moves_page.goto(page_link, { waitUntil: 'networkidle2', timeout: 0 });
            generation_moves = await moves_page.evaluate(() => {
                const moves = {};
                const links = {};
                const titles = Array.from(
                    document.querySelector('.tabset-moves-game').firstElementChild.querySelectorAll('.sv-tabs-tab')
                ).map(x => x.innerText);
                const moves_game_content = Array.from(document.querySelector('.tabset-moves-game').lastElementChild.querySelectorAll('.sv-tabs-panel'));
                for (let i = 0; i < titles.length; i++) {
                    const title = titles[i];
                    moves[title] = {
                        level_up: [],
                        egg: [],
                        hm: [],
                        tm: [],
                        tr: [],
                        tutor: [],
                        transfer_only: []
                    };
                    const move_categories = Array.from(moves_game_content[i].querySelectorAll('h3'));
                    for (let category of move_categories) {
                        // level up moves
                        if (category.innerText.contains('level up')) {
                            const level_up_moves = category.nextElementSibling.nextElementSibling;
                            if (level_up_moves !== null) {
                                if (level_up_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(level_up_moves.querySelectorAll('.ent-name'))) {
                                        let level = parseInt(move.parentElement.previousElementSibling.innerText);
                                        moves[title].level_up.push({level: level, name: move.innerText});
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (level_up_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(level_up_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(level_up_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            let level = parseInt(move.parentElement.previousElementSibling.innerText);
                                            moves[form_name][title].level_up.push({level: level, name: move.innerText});
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // egg moves
                        if (category.innerText.startsWith('Egg')) {
                            const egg_moves = category.nextElementSibling.nextElementSibling;
                            if (egg_moves !== null) {
                                if (egg_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(egg_moves.querySelectorAll('.ent-name'))) {
                                        moves[title].egg.push(move.innerText);
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (egg_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(egg_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(egg_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            moves[form_name][title].egg.push(move.innerText);
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // hm moves
                        if (category.innerText.endsWith('HM')) {
                            const hm_moves = category.nextElementSibling.nextElementSibling;
                            if (hm_moves !== null) {
                                if (hm_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(hm_moves.querySelectorAll('.ent-name'))) {
                                        let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                        moves[title].hm.push({number: number, name: move.innerText});
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (hm_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(hm_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(hm_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                            moves[form_name][title].hm.push({number: number, name: move.innerText});
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // tm moves
                        if (category.innerText.endsWith('TM')) {
                            const tm_moves = category.nextElementSibling.nextElementSibling;
                            if (tm_moves !== null) {
                                if (tm_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(tm_moves.querySelectorAll('.ent-name'))) {
                                        let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                        moves[title].tm.push({number: number, name: move.innerText});
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (tm_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(tm_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(tm_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                            moves[form_name][title].tm.push({number: number, name: move.innerText});
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // tr moves
                        if (category.innerText.endsWith('TR')) {
                            const tr_moves = category.nextElementSibling.nextElementSibling;
                            if (tr_moves !== null) {
                                if (tr_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(tr_moves.querySelectorAll('.ent-name'))) {
                                        let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                        moves[title].tr.push({number: number, name: move.innerText});
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (tr_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(tr_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(tr_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            let number = parseInt(move.parentElement.previousElementSibling.firstElementChild.innerText);
                                            moves[form_name][title].tr.push({number: number, name: move.innerText});
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // tutor moves
                        if (category.innerText.startsWith('Move Tutor')) {
                            const tutor_moves = category.nextElementSibling.nextElementSibling;
                            if (tutor_moves !== null) {
                                if (tutor_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(tutor_moves.querySelectorAll('.ent-name'))) {
                                        moves[title].tutor.push(move.innerText);
                                        if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                    }
                                } else if (tutor_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(tutor_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(tutor_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            moves[form_name][title].tutor.push(move.innerText);
                                            if (links[move.innerText] === undefined)
                                            links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                        // category_lookup = {
                        //     'Level Up': { id: 'level_up', is_match: x => x.innerText.contains('level up'), is_numeric: true },
                        //     'Egg': { id: 'egg', is_match: x => x.innerText.startsWith('Egg'), is_numeric: false },
                        //     'HM': { id: 'hm', is_match: x => x.innerText.endsWith('HM'), is_numeric: true },
                        //     'TM': { id: 'tm', is_match: x => x.innerText.endsWith('TM'), is_numeric: true },
                        //     'TR': { id: 'tr', is_match: x => x.innerText.endsWith('TR'), is_numeric: true },
                        //     'Move Tutor': { id: 'tutor', is_match: x => x.innerText.startsWith('Move Tutor'), is_numeric: false },
                        //     'Transfer Only': { id: 'transfer_only', is_match: x => x.innerText.startsWith('Transfer-only'), is_numeric: false }
                        // };
                        // transfer only moves
                        if (category.innerText.startsWith('Transfer-only')) {
                            const transfer_only_moves = category.nextElementSibling.nextElementSibling;
                            if (transfer_only_moves !== null) {
                                if (transfer_only_moves.className.contains('resp-scroll')) {
                                    for (let move of Array.from(transfer_only_moves.querySelectorAll('.ent-name'))) {
                                        moves[title].transfer_only.push(move.innerText);
                                        if (links[move.innerText] === undefined)
                                        links[move.innerText] = move.href;
                                    }
                                } else if (transfer_only_moves.className.contains('tabset-moves-game-form')) {
                                    moves.multiple_forms = true;
                                    const form_titles = Array.from(transfer_only_moves.querySelectorAll('.sv-tabs-tab')).map(x => x.innerText);
                                    const form_moves_lists = Array.from(transfer_only_moves.querySelectorAll('.sv-tabs-panel'));
                                    for (let j = 0; j < form_titles.length; j++) {
                                        const form_name = form_titles[j];
                                        if (moves[form_name] === undefined)
                                            moves[form_name] = {};
                                        if (moves[form_name][title] === undefined)
                                            moves[form_name][title] = { level_up: [], egg: [], hm: [], tm: [], tr: [], tutor: [], transfer_only: [] };
                                        for (let move of Array.from(form_moves_lists[j].querySelectorAll('.ent-name'))) {
                                            moves[form_name][title].transfer_only.push(move.innerText);
                                            if (links[move.innerText] === undefined)
                                                links[move.innerText] = move.href;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return { moves: moves, links: links };
            });
            if (generation_moves.multiple_forms) {
                for (let form_name of Object.keys(generation_moves).filter(x => x !== 'multiple_forms')) {
                    if (form_name !== entry_obj.name && pokedex[entry_obj.name][form_name] === undefined) {
                        pokedex[entry_obj.name][form_name] = {};
                    }
                    for (let game of Object.keys(generation_moves.moves[form_name])) {
                        if (form_name === entry_obj.name) {
                            moves[game] = generation_moves.moves[form_name][game];
                        } else {
                            if (pokedex[entry_obj.name][form_name].moves === undefined) {
                                pokedex[entry_obj.name][form_name].moves = {};
                            }
                            pokedex[entry_obj.name][form_name].moves[game] = generation_moves.moves[form_name][game];
                        }
                    }
                }
            } else {
                for (let game of Object.keys(generation_moves.moves)) {
                    moves[game] = generation_moves.moves[game];
                }
            }
            for (let link of Object.keys(generation_moves.links)) {
                movedex[link] = generation_moves.links[link];
            }
        }
        await moves_page.close();
        // console.log(moves);

        Object.assign(pokedex[entry_obj.name], {
            species: species,
            generation: generation,
            national_no: number,
            local_no: local_no,
            ev_yield: training_data.ev_yield,
            catch_rate: training_data.catch_rate,
            base_friendship: training_data.base_friendship,
            growth_rate: training_data.growth_rate,
            egg_groups: breeding_data.egg_groups,
            gender_ratio: breeding_data.gender_ratio,
            egg_cycles: breeding_data.egg_cycles,
            evolution: evolution[entry_obj.name],
            pokedex_entry: pokedex_entry[entry_obj.name],
            locations: locations,
            moves: moves
        });
        console.log(pokedex[entry_obj.name]);
        console.log(entry_obj.name + "  " + number);
    }

    var fs = require('fs').promises;
    await fs.writeFile('pokedex.json', JSON.stringify(pokedex, space=4));
    await fs.writeFile('movedex_links.json', JSON.stringify(movedex, space=4));
    await fs.writeFile('lookup_by_location.json', JSON.stringify(lookup_by_location, space=4));
    await fs.writeFile('lookup_by_number.json', JSON.stringify(lookup_by_number, space=4));

    await browser.close();
})();
