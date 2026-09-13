const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const deferred = () => {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
};

async function harness() {
    const properties = new Map();
    const records = new Map();
    const requests = [];
    const forms = [];
    const messages = [];
    const errors = [];
    const commands = new Map();
    const state = { status: 200, beforeRequest: undefined, responses: [] };
    const context = vm.createContext({
        console: { error: (...args) => errors.push(args), warn: (...args) => errors.push(args) }
    });
    const modules = new Map();
    const system = {
        run: callback => callback(),
        runInterval: () => {},
        beforeEvents: { startup: { subscribe: callback => callback({
            customCommandRegistry: { registerCommand: (definition, callback) => commands.set(definition.name, callback) }
        }) } }
    };
    class ActionFormData {
        constructor() { this.buttons = []; }
        title(value) { this.titleValue = value; return this; }
        body(value) { this.bodyValue = value; return this; }
        button(value) { this.buttons.push(value); return this; }
        async show() { forms.push(this); return state.responses.shift() || { canceled: true }; }
    }
    const mocks = {
        '@minecraft/server': {
            world: {
                getDynamicPropertyIds: () => [...properties.keys()],
                getDynamicProperty: key => properties.get(key),
                setDynamicProperty: (key, value) => value === undefined ? properties.delete(key) : properties.set(key, value)
            }, system, CommandPermissionLevel: { Any: 0 }
        },
        '@minecraft/server-ui': { ActionFormData, ModalFormData: class {}, MessageFormData: class {} },
        '@minecraft/server-net': {
            HttpRequest: class { constructor(uri) { this.uri = uri; } },
            HttpHeader: class { constructor(name, value) { this.name = name; this.value = value; } },
            HttpRequestMethod: { Get: 'GET', Post: 'POST', Delete: 'DELETE' },
            http: { request: async req => {
                const url = new URL(req.uri);
                const payload = req.body ? JSON.parse(req.body) : undefined;
                requests.push({ method: req.method, path: url.pathname, payload });
                if (state.beforeRequest) await state.beforeRequest(req);
                if (state.status !== 200) return { status: state.status, body: 'failure' };
                if (req.method === 'GET') return { status: 200, body: JSON.stringify(records.get(url.pathname) || {}) };
                if (req.method === 'POST') records.set(`${url.pathname}/${payload.id}`, payload.data);
                if (req.method === 'DELETE') records.delete(url.pathname);
                return { status: 200, body: 'OK' };
            } }
        }
    };
    const stubs = {
        'country.js': { Country: {} },
        'war.js': { War: { isProtected: () => false } },
        'util.js': { Util: {} },
        'config.js': { default: {} }
    };
    function getModule(id) {
        if (modules.has(id)) return modules.get(id);
        const mock = mocks[id] || stubs[path.basename(id)];
        const module = mock
            ? new vm.SyntheticModule(Object.keys(mock), function () {
                for (const [key, value] of Object.entries(mock)) this.setExport(key, value);
            }, { context, identifier: id })
            : new vm.SourceTextModule(fs.readFileSync(id, 'utf8'), { context, identifier: id });
        modules.set(id, module);
        return module;
    }
    const linker = (specifier, reference) => {
        if (mocks[specifier]) return getModule(specifier);
        let id = path.resolve(path.dirname(reference.identifier), specifier);
        if (!path.extname(id)) id += '.js';
        return getModule(id);
    };
    async function load(relative) {
        const module = getModule(path.join(root, relative));
        if (module.status === 'unlinked') await module.link(linker);
        if (module.status === 'linked') await module.evaluate();
        return module.namespace;
    }
    await load('scripts/commands/countrylist.js');
    const stores = await load('scripts/utils/data_store.js');
    const { Dypro } = await load('scripts/utils/dypro.js');
    const countryModule = modules.get(path.join(root, 'scripts/commands/countrylist.js'));
    // Expose the command's completion to tests without changing its production exports.
    const invokeModule = new vm.SourceTextModule(
        fs.readFileSync(countryModule.identifier, 'utf8') + '\nexport { showCountryList };',
        { context, identifier: countryModule.identifier }
    );
    await invokeModule.link(linker);
    await invokeModule.evaluate();
    const player = { isValid: true, typeId: 'minecraft:player', sendMessage: value => messages.push(value) };
    return { properties, records, requests, forms, messages, errors, state, stores, Dypro,
        show: () => invokeModule.namespace.showCountryList(player) };
}

test('numeric and string IDs share cache, dirty state, flush and delete', async () => {
    const h = await harness();
    const store = h.stores.CountryDataStore;
    const country = { id: 2, name: 'New country' };
    await store.setAll(2, country);
    assert.equal(store.getSync('2'), country);
    assert.equal(await store.get('2'), country);
    await store.setProperty(2, 'money', 123);
    assert.deepEqual([...store.cache.keys()], ['2']);
    assert.deepEqual([...store.dirtyIds], ['2']);
    assert.equal(h.requests.length, 0);
    await store.flush(2);
    assert.equal(h.records.get('/dypro/country/2').money, 123);
    assert.equal(store.dirtyIds.size, 0);
    await store.remove(2);
    assert.equal(store.getSync('2'), undefined);
    assert.equal(h.records.has('/dypro/country/2'), false);
});

test('first country list waits for HTTP and includes every country beyond cache capacity', async () => {
    const h = await harness();
    h.stores.CountryDataStore.maxSize = 2;
    for (let id = 1; id <= 5; id++) {
        h.properties.set(`country.${id}`, '{}');
        h.records.set(`/dypro/country/${id}`, { id, name: `Country ${id}` });
    }
    const gate = deferred();
    h.state.beforeRequest = () => gate.promise;
    const showing = h.show();
    assert.equal(h.forms.length, 0);
    gate.resolve();
    await showing;
    assert.deepEqual(h.forms[0].buttons, ['Country 1', 'Country 2', 'Country 3', 'Country 4', 'Country 5']);
    assert.equal(h.stores.CountryDataStore.cache.size, 2);
});

test('new numeric country appears immediately without fetching an older DB value', async () => {
    const h = await harness();
    await new h.Dypro('country').set(2, { id: 2, name: 'New country' });
    await h.show();
    assert.deepEqual(h.forms[0].buttons, ['New country']);
    assert.equal(h.requests.length, 0);
});

test('concurrent loads share HTTP and cannot overwrite a newer local edit', async () => {
    const h = await harness();
    const store = h.stores.CountryDataStore;
    const gate = deferred();
    h.state.beforeRequest = () => gate.promise;
    h.records.set('/dypro/country/2', { id: 2, name: 'Old' });
    const first = store.get(2);
    const second = store.get('2');
    const edited = { id: 2, name: 'Edited' };
    await store.setAll(2, edited);
    gate.resolve();
    assert.equal(await first, edited);
    assert.equal(await second, edited);
    assert.equal(store.getSync('2'), edited);
    assert.equal(h.requests.length, 1);
});

test('HTTP 400 leaves unsaved data available for a successful retry', async () => {
    const h = await harness();
    const store = h.stores.CountryDataStore;
    await store.setAll(2, { id: 2, name: 'Unsaved' });
    h.state.status = 400;
    await assert.rejects(store.flushAll(), /400/);
    assert.equal(store.dirtyIds.has('2'), true);
    assert.equal(store.getSync(2).name, 'Unsaved');
    h.state.status = 200;
    await store.flushAll();
    assert.equal(store.dirtyIds.size, 0);
    assert.equal(h.records.get('/dypro/country/2').name, 'Unsaved');
});

test('failed eviction retains dirty data instead of losing the only copy', async () => {
    const h = await harness();
    const store = h.stores.CountryDataStore;
    store.maxSize = 1;
    await store.setAll(2, { id: 2, name: 'Unsaved' });
    h.state.status = 500;
    await assert.rejects(store.setAll(3, { id: 3 }), /500/);
    assert.equal(store.getSync(2).name, 'Unsaved');
    assert.equal(store.dirtyIds.has('2'), true);
});

test('failed reads show an error, do not cache an empty country, and can retry', async () => {
    const h = await harness();
    h.properties.set('country.2', '{}');
    h.records.set('/dypro/country/2', { id: 2, name: 'Recovered' });
    h.state.status = 403;
    await h.show();
    assert.equal(h.forms.length, 0);
    assert.equal(h.messages.length, 1);
    assert.equal(h.stores.CountryDataStore.cache.size, 0);
    assert.equal(h.stores.CountryDataStore.pendingLoads.size, 0);
    h.state.status = 200;
    await h.show();
    assert.deepEqual(h.forms[0].buttons, ['Recovered']);
});

test('network failures reject and keep writes dirty', async () => {
    const h = await harness();
    await h.stores.PlayerDataStore.setAll('player', { money: 123 });
    h.state.beforeRequest = () => { throw new Error('offline'); };
    await assert.rejects(h.stores.PlayerDataStore.flushAll(), /offline/);
    assert.equal(h.stores.PlayerDataStore.dirtyIds.has('player'), true);
});

test('absent optional country IDs do not send requests and invalid writes are rejected', async () => {
    const h = await harness();
    assert.equal(await h.stores.CountryDataStore.get(undefined), undefined);
    await assert.rejects(h.stores.CountryDataStore.setAll(NaN, {}), /不正/);
    await assert.rejects(h.stores.CountryDataStore.setAll(2, undefined), /不正/);
    assert.equal(h.requests.length, 0);
});

test('market pages remain arrays and numeric page zero saves as string zero', async () => {
    const h = await harness();
    h.records.set('/dypro/playermarket/0', [{ item: 'stone' }]);
    const page = await h.stores.PlayerMarketDataStore.get(0);
    assert.equal(Array.isArray(page), true);
    assert.equal(page[0].item, 'stone');
    await h.stores.PlayerMarketDataStore.setAll(0, page);
    await h.stores.PlayerMarketDataStore.flush(0);
    assert.equal(h.requests.at(-1).payload.id, '0');
});
