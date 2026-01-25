import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Shield, Zap, Coffee, GraduationCap, Edit2, Heart } from 'lucide-react';
import { KeyRelationship } from '../../types/user';
import { AtmanService } from '../../lib/atman';
import { RelationshipForm } from './RelationshipForm';

interface InnerCircleManagerProps {
    userId: string;
    keyRelationships: KeyRelationship[];
    onRefresh: () => void;
}

export const InnerCircleManager: React.FC<InnerCircleManagerProps> = ({
    userId,
    keyRelationships,
    onRefresh
}) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRel, setEditingRel] = useState<KeyRelationship | undefined>();

    const handleSave = async (relData: Omit<KeyRelationship, 'id'> | Partial<KeyRelationship>) => {
        if (editingRel) {
            await AtmanService.updateRelationship(userId, editingRel.id, relData);
        } else {
            await AtmanService.addRelationship(userId, relData as Omit<KeyRelationship, 'id'>);
        }
        setIsFormOpen(false);
        setEditingRel(undefined);
        onRefresh();
    };

    const handleDelete = async () => {
        if (editingRel) {
            await AtmanService.deleteRelationship(userId, editingRel.id);
            setIsFormOpen(false);
            setEditingRel(undefined);
            onRefresh();
        }
    };

    const getDynamicStyles = (dynamic: string) => {
        switch (dynamic) {
            case 'supportive': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'conflict': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'distant': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            case 'teacher': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            default: return 'bg-white/5 text-white/40 border-white/10';
        }
    };

    const getRelationIcon = (relation: string) => {
        switch (relation) {
            case 'partner': return <Zap size={14} className="text-pink-400" />;
            case 'parent': return <Shield size={14} className="text-blue-400" />;
            case 'child': return <Heart size={14} className="text-orange-400" />;
            case 'boss': return <Coffee size={14} className="text-yellow-400" />;
            case 'friend': return <Users size={14} className="text-emerald-400" />;
            default: return <GraduationCap size={14} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gold">
                    <Users size={18} />
                    <h3 className="font-display uppercase tracking-widest text-sm">The Sangha (Inner Circle)</h3>
                </div>
                <button
                    onClick={() => {
                        setEditingRel(undefined);
                        setIsFormOpen(true);
                    }}
                    className="p-1.5 bg-gold/10 hover:bg-gold/20 text-gold rounded-lg transition-colors"
                    title="Add to Sangha"
                >
                    <Plus size={18} />
                </button>
            </div>

            {keyRelationships.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-8 text-center">
                    <Users size={32} className="text-white/10 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">
                        No connections mapped yet.<br />
                        Add key people to give the Guru social context.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {keyRelationships.map((rel) => (
                        <motion.div
                            key={rel.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-4 group hover:border-gold/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold">
                                        {rel.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-white font-medium">{rel.name}</h4>
                                        <div className="flex items-center gap-1.5">
                                            {getRelationIcon(rel.relation)}
                                            <span className="text-[10px] uppercase tracking-wider text-white/40">
                                                {rel.relation}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setEditingRel(rel);
                                        setIsFormOpen(true);
                                    }}
                                    className="p-1.5 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white transition-all"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getDynamicStyles(rel.dynamic)}`}>
                                    {rel.dynamic}
                                </span>
                                {rel.zodiacSign && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">
                                        {rel.zodiacSign}
                                    </span>
                                )}
                            </div>
                            
                            {rel.notes && (
                                <p className="mt-2 text-[11px] text-white/30 line-clamp-1 italic">
                                    "{rel.notes}"
                                </p>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isFormOpen && (
                    <RelationshipForm
                        relationship={editingRel}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onClose={() => {
                            setIsFormOpen(false);
                            setEditingRel(undefined);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
