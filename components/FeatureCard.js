"use client";

import Link from "next/link";
import { ArrowRight, Dices, ListChecks, Users, CircleDot, Construction } from "lucide-react";
import styles from "./FeatureCard.module.css";

const ICON_MAP = {
  Dices,
  ListChecks,
  Users,
  CircleDot,
};

export function FeatureCard({ name, description, icon, href, color, status }) {
  const Icon = ICON_MAP[icon] || Dices;
  const isComingSoon = status === "dev";

  const cardContent = (
    <>
      <div className={styles.header}>
        <div
          className={styles.iconWrapper}
          style={{ background: `${color}22` }}
        >
          <Icon size={24} style={{ color }} />
        </div>
        <h3 className={styles.name}>{name}</h3>
      </div>

      <p className={styles.description}>{description}</p>

      <div className={styles.footer}>
        {isComingSoon ? (
          <span
            className={styles.badge}
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
          >
            <Construction size={12} /> Coming Soon
          </span>
        ) : (
          <span
            className={styles.badge}
            style={{ background: `${color}22`, color }}
          >
            Live
          </span>
        )}

        <span className={styles.arrow}>
          Open <ArrowRight size={16} />
        </span>
      </div>
    </>
  );

  if (isComingSoon) {
    return (
      <div
        className={`${styles.card} ${styles.comingSoon}`}
        style={{ "--accent": color, borderTop: `none` }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            borderRadius: "20px 20px 0 0",
          }}
        />
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={styles.card}
      style={{ "--accent": color }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: "20px 20px 0 0",
        }}
      />
      {cardContent}
    </Link>
  );
}
