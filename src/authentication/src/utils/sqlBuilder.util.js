class SqlBuilder {
    constructor() {
        this.clauses = [];
        this.values = [];
    }
    and(condition, value) {
        if (value !== undefined && value !== null) {
            this.values.push(value);
            this.clauses.push(`${condition} $${this.values.length}`);

        }
        return this;
    }
    toWhere(defaultTrue = '1=1') {
        return this.clauses.length
            ? { sql: 'WHERE ' + this.clauses.join(' AND '), values: this.values }
            : { sql: 'WHERE ' + defaultTrue, values: [] };
    }
}
module.exports = SqlBuilder;


//Algorithm note: This is O(n) over number of filters and removes the risk of SQL-injection via pg parameter binding.