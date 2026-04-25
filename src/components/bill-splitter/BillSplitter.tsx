"use client";

import React, { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";

// --- Types ---
type Person = {
    id: string;
    name: string;
    individualItems: { [itemId: string]: string }; // Map of itemRowId -> amount
};

type ItemRow = {
    id: string;
    label: string; // e.g., "Item 1", "Item 2"
};

type SharedItem = {
    id: string;
    name: string;
    amount: string;
    checkedPeople: { [personId: string]: boolean };
};

export function BillSplitter() {
    // --- State Initialization ---
    // Default people requested by user
    const initialNames = ["Mike", "Erin", "Alexa", "Robb", "Emily", "Vishy", "Christian"];
    const initialPeople = initialNames.map((name, i) => ({
        id: `p${i}`,
        name: name,
        individualItems: {},
    }));

    const [people, setPeople] = useState<Person[]>(initialPeople);

    const [individualItemRows, setIndividualItemRows] = useState<ItemRow[]>([
        { id: "r1", label: "Item 1" },
        { id: "r2", label: "Item 2" },
        { id: "r3", label: "Item 3" },
    ]);

    const [sharedItems, setSharedItems] = useState<SharedItem[]>([
        { id: "s1", name: "Appetizer 1", amount: "", checkedPeople: {} },
        { id: "s2", name: "Wine Bottle", amount: "", checkedPeople: {} },
    ]);

    const [receiptSubtotalInput, setReceiptSubtotalInput] = useState<string>("");
    const [receiptGrandTotalInput, setReceiptGrandTotalInput] = useState<string>("");

    // --- Helpers ---
    const val = (s: string) => parseFloat(s) || 0;

    // --- Handlers ---
    const handleNameChange = (id: string, newName: string) => {
        setPeople(people.map((p) => (p.id === id ? { ...p, name: newName } : p)));
    };

    const addPerson = () => {
        const newId = `p${Date.now()}`;
        setPeople([...people, { id: newId, name: "New", individualItems: {} }]);
    };

    const clearNames = () => {
        if (confirm("Clear all names and reset columns?")) {
            const newPeople = Array.from({ length: 3 }, (_, i) => ({
                id: `p${Date.now()}-${i}`,
                name: "",
                individualItems: {}
            }));
            setPeople(newPeople);
        }
    };

    const handleIndivAmountChange = (personId: string, rowId: string, amount: string) => {
        setPeople(
            people.map((p) =>
                p.id === personId
                    ? { ...p, individualItems: { ...p.individualItems, [rowId]: amount } }
                    : p
            )
        );
    };

    const handleSharedNameChange = (id: string, name: string) => {
        setSharedItems(sharedItems.map((s) => (s.id === id ? { ...s, name } : s)));
    };

    const handleSharedAmountChange = (id: string, amount: string) => {
        setSharedItems(sharedItems.map((s) => (s.id === id ? { ...s, amount } : s)));
    };

    const toggleSharedCheck = (itemId: string, personId: string) => {
        setSharedItems(
            sharedItems.map((s) => {
                if (s.id !== itemId) return s;
                return {
                    ...s,
                    checkedPeople: {
                        ...s.checkedPeople,
                        [personId]: !s.checkedPeople[personId],
                    },
                };
            })
        );
    };

    // --- Calculations ---
    // 1. Calculate Per Person Subtotal
    const getPersonSubtotal = (p: Person) => {
        let sum = 0;
        // Individual
        Object.values(p.individualItems).forEach((amt) => (sum += val(amt)));
        // Shared
        sharedItems.forEach((s) => {
            const amount = val(s.amount);
            const involvedIds = Object.keys(s.checkedPeople).filter((k) => s.checkedPeople[k]);
            if (s.checkedPeople[p.id] && involvedIds.length > 0) {
                sum += amount / involvedIds.length;
            }
        });
        return sum;
    };

    const personSubtotals = people.map((p) => getPersonSubtotal(p));
    const calculatedSubtotal = personSubtotals.reduce((a, b) => a + b, 0);

    const receiptSubtotal = val(receiptSubtotalInput);
    const receiptGrandTotal = val(receiptGrandTotalInput);

    // Validation
    const subtotalMismatch = Math.abs(receiptSubtotal - calculatedSubtotal) > 0.1; // 10 cent tolerance
    const validationColor = subtotalMismatch && receiptSubtotal > 0 ? "bg-red-500 text-white" : "bg-neutral-100 text-black";

    // Multiplier logic
    const multiplier =
        receiptGrandTotal > 0 && calculatedSubtotal > 0
            ? receiptGrandTotal / calculatedSubtotal
            : 1;

    // Distribute rounding differences
    const finalDistributions = personSubtotals.map((sub) => sub * multiplier);
    const roundedAmounts = finalDistributions.map((amt) => Math.round(amt * 100) / 100);

    if (receiptGrandTotal > 0 && calculatedSubtotal > 0) {
        const currentSum = roundedAmounts.reduce((a, b) => a + b, 0);
        let diff = receiptGrandTotal - currentSum;
        diff = Math.round(diff * 100) / 100;
        let cents = Math.round(diff * 100);

        let i = 0;
        while (cents !== 0) {
            const idx = i % people.length;
            if (personSubtotals[idx] > 0) {
                roundedAmounts[idx] += cents > 0 ? 0.01 : -0.01;
                roundedAmounts[idx] = Math.round(roundedAmounts[idx] * 100) / 100;
                cents -= cents > 0 ? 1 : -1;
            }
            i++;
            if (i > 1000) break;
        }
    }

    const totalMobileCols = sharedItems.length + individualItemRows.length + 2;

    return (
        <div className="w-full text-xs font-mono pb-20">

            {/* 1. TOP BAR: Totals & Validation */}
            <div className="flex flex-col md:flex-row flex-wrap gap-6 mb-6 items-start md:items-end border border-black p-4">
                {/* Main Inputs Grouped */}
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="flex flex-col w-full sm:w-auto">
                        <label className="uppercase font-bold mb-1">Receipt Subtotal</label>
                        <div className={`flex items-center border border-black w-full sm:w-32 ${validationColor}`}>
                            <span className="pl-2 font-bold text-lg">$</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={receiptSubtotalInput}
                                onChange={(e) => setReceiptSubtotalInput(e.target.value)}
                                className="p-2 w-full font-bold text-lg focus:outline-none text-right bg-transparent no-arrows"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col w-full sm:w-auto">
                        <label className="uppercase font-bold mb-1">Including Tax/Tip</label>
                        <div className="flex items-center border border-black w-full sm:w-36 bg-yellow-50">
                            <span className="pl-2 font-bold text-lg">$</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="Total"
                                value={receiptGrandTotalInput}
                                onChange={(e) => setReceiptGrandTotalInput(e.target.value)}
                                className="p-2 w-full font-bold text-lg focus:outline-none text-right bg-transparent no-arrows"
                            />
                        </div>
                    </div>
                </div>

                <div className="h-px w-full md:w-px md:h-10 bg-black md:border-r md:border-black md:bg-transparent mx-0 md:mx-4 my-2 md:my-0"></div>

                {/* Validation Status */}
                <div className="flex flex-col w-full sm:w-auto">
                    <label className="uppercase font-bold mb-1 text-neutral-400">Calculated Sum</label>
                    <div className={`border border-black p-2 w-full sm:w-32 bg-neutral-50 text-right ${subtotalMismatch && receiptSubtotal > 0 ? "text-red-500 font-bold border-red-500" : ""}`}>
                        ${calculatedSubtotal.toFixed(2)}
                    </div>
                </div>

                {subtotalMismatch && receiptSubtotal > 0 && (
                    <div className="text-red-600 font-bold self-start md:self-center animate-pulse uppercase tracking-widest text-sm border border-red-600 px-2 py-1 mt-2 md:mt-0">
                        ⚠ Check Sum Mismatch
                    </div>
                )}

                <div className="flex flex-col ml-auto mt-2 md:mt-0">
                    <label className="uppercase font-bold mb-1 text-neutral-400">Multiplier</label>
                    <div className="p-2 font-mono text-neutral-500">
                        x{multiplier.toFixed(4)}
                    </div>
                </div>
            </div>

            {/* ===================== MOBILE LAYOUT (< md) =====================
                Transposed: people are rows, items are columns.
                People names are sticky on the left; scroll down for more people.
            */}
            <div className="md:hidden overflow-x-auto">
                <table className="w-full border-collapse border border-black">
                    <thead>
                        {/* Column headers: shared items first, then individual items, then totals */}
                        <tr className="border-b-4 border-black">
                            <th className="sticky left-0 z-10 bg-white border border-black p-1 w-20 min-w-[72px]">
                                <button
                                    className="text-red-400 flex items-center justify-center w-full"
                                    onClick={clearNames}
                                    title="Clear All"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            </th>

                            {sharedItems.map((s) => (
                                <th key={s.id} className="border border-black p-1 min-w-[56px] bg-neutral-50 align-top font-normal">
                                    <div className="flex flex-col gap-0.5">
                                        <input
                                            type="text"
                                            value={s.name}
                                            onChange={(e) => handleSharedNameChange(s.id, e.target.value)}
                                            className="w-full bg-transparent focus:outline-none font-bold text-[10px] placeholder-neutral-300 text-center"
                                            placeholder="Item"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-0 top-0 font-bold text-[10px]">$</span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={s.amount}
                                                onChange={(e) => handleSharedAmountChange(s.id, e.target.value)}
                                                className="w-full border-b border-black text-right focus:outline-none font-bold bg-yellow-50 text-[10px] pl-2 no-arrows"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </th>
                            ))}

                            {individualItemRows.map((row) => (
                                <th key={row.id} className="border border-black p-1 min-w-[52px] bg-white align-top font-normal">
                                    <input
                                        className="w-full bg-transparent focus:outline-none font-bold text-[10px] placeholder-neutral-300 text-center"
                                        defaultValue={row.label}
                                    />
                                </th>
                            ))}

                            <th className="border border-black p-1 min-w-[48px] bg-neutral-100 text-[10px] text-neutral-400 uppercase font-bold text-center">
                                Sub
                            </th>
                            <th className="border border-black p-1 min-w-[52px] bg-black text-white text-[10px] uppercase font-bold text-center">
                                Owed
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {people.map((p, i) => (
                            <tr key={p.id}>
                                <td className="sticky left-0 z-10 bg-white border border-black p-1">
                                    <input
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => handleNameChange(p.id, e.target.value)}
                                        className="w-full bg-transparent font-black text-left text-black focus:outline-none uppercase text-xs"
                                        placeholder="NAME"
                                    />
                                </td>

                                {sharedItems.map((s) => (
                                    <td
                                        key={s.id}
                                        className="border border-black p-0 cursor-pointer hover:bg-neutral-50"
                                        onClick={() => toggleSharedCheck(s.id, p.id)}
                                    >
                                        <div className="flex justify-center items-center min-h-[44px]">
                                            <div className={`w-5 h-5 border-2 border-black ${s.checkedPeople[p.id] ? 'bg-black' : 'bg-white'}`} />
                                        </div>
                                    </td>
                                ))}

                                {individualItemRows.map((row) => (
                                    <td key={row.id} className="border border-black p-0">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="-"
                                            className="w-full h-full p-0.5 text-center focus:bg-yellow-50 focus:outline-none font-medium placeholder-neutral-200 text-xs no-arrows min-h-[44px]"
                                            value={p.individualItems[row.id] || ""}
                                            onChange={(e) => handleIndivAmountChange(p.id, row.id, e.target.value)}
                                        />
                                    </td>
                                ))}

                                <td className="border border-black p-1 text-center bg-neutral-50 text-xs text-neutral-500 font-mono">
                                    {personSubtotals[i] > 0 ? `$${personSubtotals[i].toFixed(2)}` : '-'}
                                </td>
                                <td className="border border-black p-1 text-center bg-black text-white font-bold font-mono text-xs">
                                    ${roundedAmounts[i].toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    <tfoot>
                        <tr>
                            <td
                                className="sticky left-0 z-10 bg-white border border-black p-3 text-center cursor-pointer hover:bg-neutral-100 text-neutral-500 select-none"
                                onClick={addPerson}
                            >
                                + PERSON
                            </td>
                            <td colSpan={totalMobileCols} className="border border-black bg-neutral-50" />
                        </tr>
                    </tfoot>
                </table>

                {/* Add item buttons */}
                <div className="flex gap-0 mt-2">
                    <button
                        className="flex-1 p-3 border border-black text-center text-neutral-500 hover:bg-neutral-100 select-none bg-white"
                        onClick={() => setSharedItems([...sharedItems, { id: Math.random().toString(), name: "New Shared", amount: "", checkedPeople: {} }])}
                    >
                        + SHARED ITEM
                    </button>
                    <button
                        className="flex-1 p-3 border border-black border-l-0 text-center text-neutral-500 hover:bg-neutral-100 select-none bg-white"
                        onClick={() => setIndividualItemRows([...individualItemRows, { id: Math.random().toString(), label: "New Item" }])}
                    >
                        + ITEM
                    </button>
                </div>
            </div>

            {/* ===================== DESKTOP LAYOUT (md+) =====================
                Original orientation: items are rows, people are columns.
            */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse border border-black">
                    {/* 2. SHARED ITEMS SECTIONS (Appetizers) - ABOVE NAMES */}
                    <thead>
                        <tr className="bg-neutral-100">
                            <td colSpan={people.length + 2} className="border border-black p-1 font-bold text-center uppercase tracking-widest text-neutral-500 text-xs">
                                Shared Items (Appetizers, Wine, etc.)
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {sharedItems.map((s) => (
                            <tr key={s.id}>
                                <td className="border border-black p-1 bg-white min-w-[80px] w-20 align-top sticky left-0 z-10">
                                    <div className="flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={s.name}
                                            onChange={(e) => handleSharedNameChange(s.id, e.target.value)}
                                            className="w-full bg-transparent focus:outline-none font-bold placeholder-neutral-300 text-[10px]"
                                            placeholder="Item"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-0 top-0 font-bold text-xs">$</span>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={s.amount}
                                                onChange={(e) => handleSharedAmountChange(s.id, e.target.value)}
                                                className="w-full border-b-2 border-black text-right focus:outline-none placeholder-neutral-300 font-bold bg-yellow-50 text-xs pl-3 no-arrows"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </td>
                                {people.map((p) => (
                                    <td key={p.id} className="border border-black p-0 text-center hover:bg-neutral-50 cursor-pointer min-w-[44px] align-middle" onClick={() => toggleSharedCheck(s.id, p.id)}>
                                        <div className="flex justify-center items-center min-h-[44px]">
                                            <div className={`w-5 h-5 border-2 border-black flex items-center justify-center ${s.checkedPeople[p.id] ? 'bg-black' : 'bg-white'}`} />
                                        </div>
                                    </td>
                                ))}
                                <td className="border border-black bg-neutral-100"></td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={people.length + 2} className="p-3 border border-black text-center cursor-pointer hover:bg-neutral-100 text-neutral-500 select-none" onClick={() => setSharedItems([...sharedItems, { id: Math.random().toString(), name: "New Shared", amount: "", checkedPeople: {} }])}>
                                + ADD SHARED ROW
                            </td>
                        </tr>
                    </tbody>

                    {/* 3. NAME ROW (Anchor) */}
                    <thead>
                        <tr className="border-t-4 border-b-4 border-black">
                            <th className="border-r border-black p-2 bg-white text-black text-right w-20 min-w-[80px] group relative sticky left-0 z-10">
                                <div className="absolute left-2 top-0 bottom-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-red-500" onClick={clearNames} title="Clear All">
                                    <RotateCcw className="w-4 h-4" />
                                </div>
                            </th>
                            {people.map((p) => (
                                <th key={p.id} className="border-r border-black p-1 min-w-[64px] bg-white">
                                    <input
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => handleNameChange(p.id, e.target.value)}
                                        className="w-full bg-transparent font-black text-center text-black focus:outline-none border-2 border-transparent focus:border-black uppercase text-sm"
                                        placeholder="NAME"
                                    />
                                </th>
                            ))}
                            <th className="border-r border-black p-1 w-10 bg-neutral-100 cursor-pointer hover:bg-neutral-200" onClick={addPerson}>
                                <div className="flex items-center justify-center h-full">
                                    <Plus className="w-4 h-4" />
                                </div>
                            </th>
                        </tr>
                    </thead>

                    {/* 4. INDIVIDUAL ITEMS SECTIONS - BELOW NAMES */}
                    <tbody>
                        <tr className="bg-neutral-100">
                            <td colSpan={people.length + 2} className="border border-black p-1 font-bold text-center uppercase tracking-widest text-neutral-500 text-xs">
                                Individual Items
                            </td>
                        </tr>
                        {individualItemRows.map((row) => (
                            <tr key={row.id}>
                                <td className="border border-black p-0.5 pl-2 bg-white text-xs w-20 min-w-[80px] sticky left-0 z-10">
                                    <input
                                        className="w-full bg-transparent focus:outline-none font-bold placeholder-neutral-300 py-1"
                                        defaultValue={row.label}
                                    />
                                </td>
                                {people.map((p) => (
                                    <td key={p.id} className="border border-black p-0">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="-"
                                            className="w-full h-full p-0.5 text-center focus:bg-yellow-50 focus:outline-none font-medium placeholder-neutral-200 text-xs no-arrows min-h-[44px]"
                                            value={p.individualItems[row.id] || ""}
                                            onChange={(e) => handleIndivAmountChange(p.id, row.id, e.target.value)}
                                        />
                                    </td>
                                ))}
                                <td className="border border-black bg-neutral-100"></td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={people.length + 2} className="p-3 border border-black text-center cursor-pointer hover:bg-neutral-100 text-neutral-500 select-none" onClick={() => setIndividualItemRows([...individualItemRows, { id: Math.random().toString(), label: "New Item" }])}>
                                + ADD INDIVIDUAL ROW
                            </td>
                        </tr>
                    </tbody>

                    {/* 5. FOOTER: Final Amounts */}
                    <tfoot>
                        <tr className="border-t-4 border-black">
                            <td className="p-2 font-bold uppercase border border-black text-right pr-4 text-neutral-500 text-xs bg-neutral-50 sticky left-0 z-10">Calculated Subtotal</td>
                            {personSubtotals.map((sub, i) => (
                                <td key={i} className="p-1 text-center font-mono border border-black bg-neutral-50 text-neutral-500 text-xs">
                                    {sub > 0 ? `$${sub.toFixed(2)}` : '-'}
                                </td>
                            ))}
                            <td className="border border-black bg-neutral-100"></td>
                        </tr>
                        <tr className="bg-black text-white border-t-8 border-black text-sm">
                            <td className="p-2 font-bold uppercase border-r border-white/50 text-right pr-4 bg-black sticky left-0 z-10">Final Owed</td>
                            {roundedAmounts.map((amt, i) => (
                                <td key={i} className="p-1 text-center font-mono font-bold border-r border-white/50 text-md">
                                    ${amt.toFixed(2)}
                                </td>
                            ))}
                            <td className="border-l border-white/50"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
