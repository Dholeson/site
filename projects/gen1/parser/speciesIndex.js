// Gen I internal species index → National Pokédex number mapping.
//
// Source: Bulbapedia "List of Pokémon by index number (Generation I)"
// https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_index_number_(Generation_I)
//
// The internal index is NOT the same as the dex number.
// 39 indices are MissingNo. / unused — those map to 0 here.
// Indices 0x00 and 0xBF–0xFF are invalid and also map to 0.
const INDEX_TO_DEX = (() => {
    const t = new Array(256).fill(0);
    t[0x01] = 112;
    t[0x02] = 115;
    t[0x03] = 32;
    t[0x04] = 35;
    t[0x05] = 21;
    t[0x06] = 100;
    t[0x07] = 34;
    t[0x08] = 80;
    t[0x09] = 2;
    t[0x0A] = 103;
    t[0x0B] = 108;
    t[0x0C] = 102;
    t[0x0D] = 88;
    t[0x0E] = 94;
    t[0x0F] = 29;
    t[0x10] = 31;
    t[0x11] = 104;
    t[0x12] = 111;
    t[0x13] = 131;
    t[0x14] = 59;
    t[0x15] = 151;
    t[0x16] = 130;
    t[0x17] = 90;
    t[0x18] = 72;
    t[0x19] = 92;
    t[0x1A] = 123;
    t[0x1B] = 120;
    t[0x1C] = 9;
    t[0x1D] = 127;
    t[0x1E] = 114;
    // 0x1F, 0x20 = MissingNo
    t[0x21] = 58;
    t[0x22] = 95;
    t[0x23] = 22;
    t[0x24] = 16;
    t[0x25] = 79;
    t[0x26] = 64;
    t[0x27] = 75;
    t[0x28] = 113;
    t[0x29] = 67;
    t[0x2A] = 122;
    t[0x2B] = 106;
    t[0x2C] = 107;
    t[0x2D] = 24;
    t[0x2E] = 47;
    t[0x2F] = 54;
    t[0x30] = 96;
    t[0x31] = 76;
    // 0x32 = MissingNo
    t[0x33] = 126;
    // 0x34 = MissingNo
    t[0x35] = 125;
    t[0x36] = 82;
    t[0x37] = 109;
    // 0x38 = MissingNo
    t[0x39] = 56;
    t[0x3A] = 86;
    t[0x3B] = 50;
    t[0x3C] = 128;
    // 0x3D, 0x3E, 0x3F = MissingNo
    t[0x40] = 83;
    t[0x41] = 48;
    t[0x42] = 149;
    // 0x43, 0x44, 0x45 = MissingNo
    t[0x46] = 84;
    t[0x47] = 60;
    t[0x48] = 124;
    t[0x49] = 146;
    t[0x4A] = 144;
    t[0x4B] = 145;
    t[0x4C] = 132;
    t[0x4D] = 52;
    t[0x4E] = 98;
    // 0x4F, 0x50, 0x51 = MissingNo
    t[0x52] = 37;
    t[0x53] = 38;
    t[0x54] = 25;
    t[0x55] = 26;
    // 0x56, 0x57 = MissingNo
    t[0x58] = 147;
    t[0x59] = 148;
    t[0x5A] = 140;
    t[0x5B] = 141;
    t[0x5C] = 116;
    t[0x5D] = 117;
    // 0x5E, 0x5F = MissingNo
    t[0x60] = 27;
    t[0x61] = 28;
    t[0x62] = 138;
    t[0x63] = 139;
    t[0x64] = 39;
    t[0x65] = 40;
    t[0x66] = 133;
    t[0x67] = 136;
    t[0x68] = 135;
    t[0x69] = 134;
    t[0x6A] = 66;
    t[0x6B] = 41;
    t[0x6C] = 23;
    t[0x6D] = 46;
    t[0x6E] = 61;
    t[0x6F] = 62;
    t[0x70] = 13;
    t[0x71] = 14;
    t[0x72] = 15;
    // 0x73 = MissingNo
    t[0x74] = 85;
    t[0x75] = 57;
    t[0x76] = 51;
    t[0x77] = 49;
    t[0x78] = 87;
    // 0x79, 0x7A = MissingNo
    t[0x7B] = 10;
    t[0x7C] = 11;
    t[0x7D] = 12;
    t[0x7E] = 68;
    // 0x7F = MissingNo
    t[0x80] = 55;
    t[0x81] = 97;
    t[0x82] = 42;
    t[0x83] = 150;
    t[0x84] = 143;
    t[0x85] = 129;
    // 0x86, 0x87 = MissingNo
    t[0x88] = 89;
    // 0x89 = MissingNo
    t[0x8A] = 99;
    t[0x8B] = 91;
    // 0x8C = MissingNo
    t[0x8D] = 101;
    t[0x8E] = 36;
    t[0x8F] = 110;
    t[0x90] = 53;
    t[0x91] = 105;
    // 0x92 = MissingNo
    t[0x93] = 93;
    t[0x94] = 63;
    t[0x95] = 65;
    t[0x96] = 17;
    t[0x97] = 18;
    t[0x98] = 121;
    t[0x99] = 1;
    t[0x9A] = 3;
    t[0x9B] = 73;
    // 0x9C = MissingNo
    t[0x9D] = 118;
    t[0x9E] = 119;
    // 0x9F–0xA2 = MissingNo
    t[0xA3] = 77;
    t[0xA4] = 78;
    t[0xA5] = 19;
    t[0xA6] = 20;
    t[0xA7] = 33;
    t[0xA8] = 30;
    t[0xA9] = 74;
    t[0xAA] = 137;
    t[0xAB] = 142;
    // 0xAC = MissingNo
    t[0xAD] = 81;
    // 0xAE, 0xAF = MissingNo
    t[0xB0] = 4;
    t[0xB1] = 7;
    t[0xB2] = 5;
    t[0xB3] = 8;
    t[0xB4] = 6;
    // 0xB5–0xB8 = MissingNo
    t[0xB9] = 43;
    t[0xBA] = 44;
    t[0xBB] = 45;
    t[0xBC] = 69;
    t[0xBD] = 70;
    t[0xBE] = 71;
    // 0xBF–0xFF = invalid
    return t;
})();
/** Convert an internal Gen I species index to a National Dex number. Returns 0 for MissingNo/invalid. */
export function indexToDex(speciesIndex) {
    return INDEX_TO_DEX[speciesIndex] ?? 0;
}
/** Build the reverse map (dex → internal index) for fixture building and display. */
export function buildDexToIndex() {
    const map = new Map();
    for (let i = 0; i < 256; i++) {
        const dex = INDEX_TO_DEX[i];
        if (dex > 0)
            map.set(dex, i);
    }
    return map;
}
