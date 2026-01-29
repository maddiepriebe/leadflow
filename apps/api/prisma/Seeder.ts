abstract class Seeder {
    protected count: number; // Number of records to seed
    protected _data: any = []; // Seed Data

    constructor(count: number) {
        this.count = count;
    }

    protected abstract createData(): void; // function to create seed data 

    get data(): [] {
        return this._data
    }
}

export default Seeder;