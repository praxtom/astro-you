import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Trash2, Save } from 'lucide-react';
import { KeyRelationship } from '../../types/user';

interface RelationshipFormProps {
    relationship?: KeyRelationship;
    onSave: (rel: Omit<KeyRelationship, 'id'> | Partial<KeyRelationship>) => void;
    onDelete?: () => void;
    onClose: () => void;
}

const RELATIONS = ['partner', 'parent', 'child', 'boss', 'friend'] as const;
const DYNAMICS = ['supportive', 'conflict', 'distant', 'teacher'] as const;
const ZODIAC_SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export const RelationshipForm: React.FC<RelationshipFormProps> = ({
    relationship,
    onSave,
    onDelete,
    onClose
}) => {
    const [name, setName] = useState(relationship?.name || '');
    const [relation, setRelation] = useState<KeyRelationship['relation']>(relationship?.relation || 'friend');
    const [dynamic, setDynamic] = useState<KeyRelationship['dynamic']>(relationship?.dynamic || 'supportive');
    const [zodiacSign, setZodiacSign] = useState(relationship?.zodiacSign || '');
    const [notes, setNotes] = useState(relationship?.notes || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({
            name,
            relation,
            dynamic,
            zodiacSign: zodiacSign || undefined,
            notes: notes || undefined
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#0F0F15] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-xl font-display text-gold">
                        {relationship ? 'Edit Connection' : 'Add New Connection'}
                    </h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Name</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">
                                <User size={16} />
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-gold/30"
                                placeholder="e.g. Anand ji"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Relation */}
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Relation</label>
                            <select
                                value={relation}
                                onChange={(e) => setRelation(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-gold/30"
                            >
                                {RELATIONS.map(r => (
                                    <option key={r} value={r} className="bg-[#151520]">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Dynamic */}
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Dynamic</label>
                            <select
                                value={dynamic}
                                onChange={(e) => setDynamic(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-gold/30"
                            >
                                {DYNAMICS.map(d => (
                                    <option key={d} value={d} className="bg-[#151520]">{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Zodiac */}
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Zodiac Sign (Optional)</label>
                        <select
                            value={zodiacSign}
                            onChange={(e) => setZodiacSign(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-gold/30"
                        >
                            <option value="" className="bg-[#151520]">Unknown</option>
                            {ZODIAC_SIGNS.map(s => (
                                <option key={s} value={s} className="bg-[#151520]">{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Notes & Karma</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-gold/30 min-h-[80px] resize-none"
                            placeholder="e.g. Tense relationship lately, needing more patience..."
                        />
                    </div>

                    <div className="pt-4 flex items-center gap-3">
                        <button
                            type="submit"
                            className="flex-1 bg-gold hover:bg-gold/90 text-black font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            Save Connection
                        </button>
                        {relationship && onDelete && (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="p-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};
